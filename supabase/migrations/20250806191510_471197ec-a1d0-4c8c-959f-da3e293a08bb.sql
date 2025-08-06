-- SECURITY FIX: Handle missing materialized view and create enhanced security monitoring
-- Fix the materialized view issue and complete security hardening

-- Only revoke from mv_volumetria_dashboard if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_volumetria_dashboard') THEN
    REVOKE ALL ON mv_volumetria_dashboard FROM PUBLIC;
    GRANT SELECT ON mv_volumetria_dashboard TO authenticated;
  END IF;
END $$;

-- Create comprehensive security monitoring view
CREATE OR REPLACE VIEW security_status_view AS
SELECT 
  'rls_tables' as metric_type,
  COUNT(*)::text as metric_value,
  'Number of tables with RLS enabled' as description
FROM pg_tables pt
WHERE pt.schemaname = 'public' 
  AND pt.rowsecurity = true

UNION ALL

SELECT 
  'total_policies' as metric_type,
  COUNT(*)::text as metric_value,
  'Total number of RLS policies' as description
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'recent_alerts' as metric_type,
  COUNT(*)::text as metric_value,
  'Security alerts in last 24 hours' as description
FROM security_alerts
WHERE timestamp > NOW() - INTERVAL '24 hours'
  AND severity IN ('high', 'critical')

UNION ALL

SELECT 
  'secure_functions' as metric_type,
  COUNT(*)::text as metric_value,
  'Functions with secure search_path' as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true;

-- Grant appropriate access to security view
GRANT SELECT ON security_status_view TO authenticated;

-- Create RLS policy for security view (admin only)
CREATE POLICY "Admin can view security status" 
ON security_status_view 
FOR SELECT 
USING (public.is_admin());

-- Enhanced rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  operation_type text,
  user_identifier text DEFAULT NULL,
  time_window interval DEFAULT INTERVAL '1 minute',
  max_operations integer DEFAULT 100
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count integer;
  identifier text;
BEGIN
  -- Use provided identifier or auth user email
  identifier := COALESCE(
    user_identifier, 
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    inet_client_addr()::text
  );
  
  -- Count recent operations
  SELECT COUNT(*) INTO current_count
  FROM audit_logs
  WHERE user_email = identifier
    AND operation = operation_type
    AND timestamp > NOW() - time_window;
  
  -- Log if approaching limit
  IF current_count > (max_operations * 0.8) THEN
    PERFORM create_security_alert(
      'rate_limit_warning',
      'medium',
      'Approaching rate limit',
      format('User %s has performed %s %s operations in %s', 
             identifier, current_count, operation_type, time_window),
      jsonb_build_object(
        'operation_type', operation_type,
        'current_count', current_count,
        'max_operations', max_operations,
        'identifier', identifier
      )
    );
  END IF;
  
  -- Return true if under limit
  RETURN current_count < max_operations;
END;
$$;

-- Create security audit summary function
CREATE OR REPLACE FUNCTION public.get_security_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  summary jsonb;
  rls_count integer;
  policy_count integer;
  alert_count integer;
  function_count integer;
BEGIN
  -- Get metrics
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables pt
  WHERE pt.schemaname = 'public' AND pt.rowsecurity = true;
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies WHERE schemaname = 'public';
  
  SELECT COUNT(*) INTO alert_count
  FROM security_alerts
  WHERE timestamp > NOW() - INTERVAL '24 hours'
    AND severity IN ('high', 'critical');
  
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.prosecdef = true;
  
  -- Build summary
  summary := jsonb_build_object(
    'rls_enabled_tables', rls_count,
    'total_policies', policy_count,
    'recent_critical_alerts', alert_count,
    'secure_functions', function_count,
    'security_score', CASE 
      WHEN rls_count >= 15 AND alert_count = 0 THEN 'HIGH'
      WHEN rls_count >= 10 AND alert_count <= 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END,
    'last_updated', NOW(),
    'recommendations', CASE 
      WHEN rls_count < 10 THEN '["Enable RLS on more tables", "Review access permissions"]'::jsonb
      WHEN alert_count > 0 THEN '["Review recent security alerts", "Update security policies"]'::jsonb
      ELSE '["Security posture is good", "Continue monitoring"]'::jsonb
    END
  );
  
  RETURN summary;
END;
$$;

-- Create automated security cleanup function
CREATE OR REPLACE FUNCTION public.security_cleanup_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean old audit logs (older than 90 days)
  DELETE FROM audit_logs 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  -- Clean old security alerts (older than 30 days)
  DELETE FROM security_alerts 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Clean old login attempts (older than 7 days)
  DELETE FROM login_attempts 
  WHERE timestamp < NOW() - INTERVAL '7 days';
  
  -- Log cleanup operation
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('system', 'SECURITY_CLEANUP', gen_random_uuid()::text,
          jsonb_build_object('cleanup_date', NOW()),
          'system', 'info');
END;
$$;