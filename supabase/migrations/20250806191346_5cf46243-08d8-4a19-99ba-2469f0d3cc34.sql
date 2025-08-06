-- ADDITIONAL SECURITY FIXES: Address remaining security vulnerabilities
-- Fix materialized views exposure and other critical issues

-- Create secure materialized view policies
-- Remove public access to materialized views that contain sensitive data
REVOKE ALL ON mv_volumetria_dashboard FROM PUBLIC;
REVOKE ALL ON mv_volumetria_stats FROM PUBLIC;

-- Grant access only to authenticated users with proper roles
GRANT SELECT ON mv_volumetria_dashboard TO authenticated;
GRANT SELECT ON mv_volumetria_stats TO authenticated;

-- Create RLS policies for materialized views access
CREATE POLICY "Admin can access volumetria dashboard" 
ON mv_volumetria_dashboard 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Manager can access volumetria dashboard" 
ON mv_volumetria_dashboard 
FOR SELECT 
USING (public.is_manager_or_admin());

-- Enhanced file upload validation with content scanning
CREATE OR REPLACE FUNCTION public.enhanced_file_validation(
  file_name text, 
  file_size bigint, 
  file_type text, 
  file_content bytea DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_file_size bigint := 50 * 1024 * 1024; -- 50MB
  allowed_types text[] := ARRAY[
    'text/csv', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  result jsonb;
  content_check boolean := true;
BEGIN
  -- Initialize result
  result := jsonb_build_object('valid', true, 'errors', '[]'::jsonb, 'warnings', '[]'::jsonb);
  
  -- Validate input using our security function
  IF NOT validate_input_security(file_name) THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["Invalid characters or potential XSS in filename"]'::jsonb);
  END IF;
  
  -- Check file size
  IF file_size > max_file_size THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["File size exceeds 50MB limit"]'::jsonb);
  END IF;
  
  -- Check file type
  IF NOT (file_type = ANY(allowed_types)) THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["Invalid file type. Only CSV, Excel and text files allowed"]'::jsonb);
  END IF;
  
  -- Check for suspicious file extensions
  IF file_name ~ '\.(exe|bat|cmd|scr|vbs|js|jar|com|pif)$' THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["Executable file extensions are not allowed"]'::jsonb);
  END IF;
  
  -- Content-based validation (if content is provided)
  IF file_content IS NOT NULL THEN
    -- Check for binary executables (MZ header)
    IF substring(file_content from 1 for 2) = '\x4D5A'::bytea THEN
      result := jsonb_set(result, '{valid}', 'false'::jsonb);
      result := jsonb_set(result, '{errors}', result->'errors' || '["Executable file detected by content analysis"]'::jsonb);
    END IF;
    
    -- Check for script content in non-script files
    IF file_type LIKE 'text/%' OR file_type LIKE 'application/vnd%' THEN
      IF convert_from(file_content, 'UTF8') ~ '(<script|javascript:|data:|vbscript:)' THEN
        result := jsonb_set(result, '{warnings}', result->'warnings' || '["Potential script content detected"]'::jsonb);
      END IF;
    END IF;
  END IF;
  
  -- Log validation attempt with enhanced details
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('file_uploads', 'ENHANCED_VALIDATE', gen_random_uuid()::text, 
          jsonb_build_object(
            'file_name', file_name, 
            'file_size', file_size, 
            'file_type', file_type, 
            'result', result,
            'content_provided', (file_content IS NOT NULL),
            'user_ip', inet_client_addr()
          ),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'anonymous'), 
          CASE WHEN (result->>'valid')::boolean THEN 'info' ELSE 'warning' END);
  
  RETURN result;
END;
$$;

-- Create function to monitor suspicious database activities
CREATE OR REPLACE FUNCTION public.monitor_suspicious_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  current_hour int;
  activity_count int;
BEGIN
  -- Get user info
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  current_hour := EXTRACT(HOUR FROM NOW());
  
  -- Check for suspicious patterns
  -- 1. Activity outside business hours (22:00 - 06:00)
  IF current_hour > 22 OR current_hour < 6 THEN
    PERFORM create_security_alert(
      'suspicious_activity',
      'medium',
      'Database activity outside business hours',
      format('User %s performed %s operation on %s at %s', 
             COALESCE(user_email, 'unknown'), 
             TG_OP, 
             TG_TABLE_NAME, 
             NOW()::text),
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'hour', current_hour,
        'user_email', user_email
      )
    );
  END IF;
  
  -- 2. Rapid consecutive operations (more than 100 in 1 minute)
  SELECT COUNT(*) INTO activity_count
  FROM audit_logs
  WHERE user_email = COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'unknown')
    AND timestamp > NOW() - INTERVAL '1 minute';
    
  IF activity_count > 100 THEN
    PERFORM create_security_alert(
      'rate_limit_exceeded',
      'high',
      'Rapid database operations detected',
      format('User %s performed %s operations in 1 minute', user_email, activity_count),
      jsonb_build_object(
        'operations_count', activity_count,
        'user_email', user_email,
        'time_window', '1 minute'
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add the monitoring trigger to sensitive tables
DROP TRIGGER IF EXISTS monitor_suspicious_volumetria ON volumetria_mobilemed;
CREATE TRIGGER monitor_suspicious_volumetria
  BEFORE INSERT OR UPDATE OR DELETE ON volumetria_mobilemed
  FOR EACH ROW EXECUTE FUNCTION monitor_suspicious_activity();

DROP TRIGGER IF EXISTS monitor_suspicious_faturamento ON faturamento;  
CREATE TRIGGER monitor_suspicious_faturamento
  BEFORE INSERT OR UPDATE OR DELETE ON faturamento
  FOR EACH ROW EXECUTE FUNCTION monitor_suspicious_activity();

-- Create security incident response function
CREATE OR REPLACE FUNCTION public.security_incident_response(
  incident_type text,
  severity text,
  affected_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  response_actions jsonb;
  lockout_duration interval;
BEGIN
  -- Determine response based on incident type and severity
  CASE incident_type
    WHEN 'multiple_failed_logins' THEN
      lockout_duration := CASE severity
        WHEN 'critical' THEN INTERVAL '1 hour'
        WHEN 'high' THEN INTERVAL '30 minutes'
        ELSE INTERVAL '15 minutes'
      END;
      
      response_actions := jsonb_build_object(
        'action', 'temporary_lockout',
        'duration', lockout_duration,
        'user_id', affected_user_id
      );
      
    WHEN 'suspicious_activity' THEN
      response_actions := jsonb_build_object(
        'action', 'enhanced_monitoring',
        'duration', INTERVAL '24 hours',
        'user_id', affected_user_id
      );
      
    ELSE
      response_actions := jsonb_build_object(
        'action', 'log_only',
        'message', 'No automated response configured'
      );
  END CASE;
  
  -- Log the incident response
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('security_incidents', 'INCIDENT_RESPONSE', gen_random_uuid()::text,
          jsonb_build_object(
            'incident_type', incident_type,
            'severity', severity,
            'response_actions', response_actions,
            'timestamp', NOW()
          ),
          'system', 'info');
          
  RETURN response_actions;
END;
$$;