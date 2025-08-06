
-- PHASE 2 CRITICAL SECURITY HARDENING
-- Fix Function Search Path Vulnerabilities and Remove Permissive Policies
-- =================================================================

-- 1. Fix remaining functions with search_path vulnerabilities
-- =================================================================

-- Fix validate_cpf function
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  digits TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
BEGIN
  digits := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  IF length(digits) != 11 THEN
    RETURN FALSE;
  END IF;
  
  IF digits ~ '^(.)\1{10}$' THEN
    RETURN FALSE;
  END IF;
  
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(digits, i, 1)::INTEGER * (11 - i));
  END LOOP;
  
  sum1 := ((sum1 * 10) % 11);
  IF sum1 = 10 THEN sum1 := 0; END IF;
  
  IF sum1 != substring(digits, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(digits, i, 1)::INTEGER * (12 - i));
  END LOOP;
  
  sum2 := ((sum2 * 10) % 11);
  IF sum2 = 10 THEN sum2 := 0; END IF;
  
  RETURN sum2 = substring(digits, 11, 1)::INTEGER;
END;
$function$;

-- Fix validate_cnpj function
CREATE OR REPLACE FUNCTION public.validate_cnpj(cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  digits TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
  weight1 INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  weight2 INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
BEGIN
  -- Remove formatação
  digits := regexp_replace(cnpj, '[^0-9]', '', 'g');
  
  -- Verifica se tem 14 dígitos
  IF length(digits) != 14 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica sequências inválidas
  IF digits ~ '^(.)\1{13}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula primeiro dígito verificador
  FOR i IN 1..12 LOOP
    sum1 := sum1 + (substring(digits, i, 1)::INTEGER * weight1[i]);
  END LOOP;
  
  sum1 := sum1 % 11;
  IF sum1 < 2 THEN sum1 := 0; ELSE sum1 := 11 - sum1; END IF;
  
  -- Verifica primeiro dígito
  IF sum1 != substring(digits, 13, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula segundo dígito verificador
  FOR i IN 1..13 LOOP
    sum2 := sum2 + (substring(digits, i, 1)::INTEGER * weight2[i]);
  END LOOP;
  
  sum2 := sum2 % 11;
  IF sum2 < 2 THEN sum2 := 0; ELSE sum2 := 11 - sum2; END IF;
  
  -- Verifica segundo dígito
  RETURN sum2 = substring(digits, 14, 1)::INTEGER;
END;
$function$;

-- Fix hash_personal_data function
CREATE OR REPLACE FUNCTION public.hash_personal_data(data text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Utiliza digest do pgcrypto para hash SHA-256
  RETURN encode(digest(data, 'sha256'), 'hex');
END;
$function$;

-- Fix get_nome_cliente_mapeado function
CREATE OR REPLACE FUNCTION public.get_nome_cliente_mapeado(nome_arquivo text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nome_mapeado TEXT;
BEGIN
  -- Buscar mapeamento ativo
  SELECT nome_sistema INTO nome_mapeado
  FROM mapeamento_nomes_clientes
  WHERE nome_arquivo = $1 AND ativo = true
  LIMIT 1;
  
  -- Se encontrou mapeamento, retornar nome do sistema
  IF nome_mapeado IS NOT NULL THEN
    RETURN nome_mapeado;
  END IF;
  
  -- Se não encontrou, retornar nome original
  RETURN nome_arquivo;
END;
$function$;

-- 2. Restrict overly permissive RLS policies
-- =================================================================

-- Remove the overly permissive policy on volumetria_mobilemed
DROP POLICY IF EXISTS "Todos podem visualizar volumetria mobilemed" ON public.volumetria_mobilemed;

-- Create company-based access policy for volumetria_mobilemed
CREATE POLICY "Users can view volumetria by company access"
ON public.volumetria_mobilemed
FOR SELECT
USING (
  public.is_manager_or_admin() OR 
  public.user_can_access_empresa("EMPRESA")
);

-- Restrict capacidade_produtiva_medico system insertion policy
DROP POLICY IF EXISTS "Sistema pode inserir capacidade" ON public.capacidade_produtiva_medico;

CREATE POLICY "Admins can insert capacity data"
ON public.capacidade_produtiva_medico
FOR INSERT
WITH CHECK (public.is_admin());

-- 3. Add enhanced file upload validation function
-- =================================================================

CREATE OR REPLACE FUNCTION public.validate_file_upload_enhanced(
  file_name text, 
  file_size bigint, 
  file_type text, 
  file_content_sample text DEFAULT NULL,
  user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_file_size bigint := 50 * 1024 * 1024; -- 50MB
  allowed_types text[] := ARRAY[
    'text/csv', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ];
  result jsonb;
  malicious_patterns text[] := ARRAY[
    '<script', '<?php', '<%', 'javascript:', 'vbscript:', 'onload=', 'onerror='
  ];
  pattern text;
BEGIN
  -- Initialize result
  result := jsonb_build_object('valid', true, 'errors', '[]'::jsonb, 'warnings', '[]'::jsonb);
  
  -- Check file size
  IF file_size > max_file_size THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["File size exceeds 50MB limit"]'::jsonb);
  END IF;
  
  -- Check file type
  IF NOT (file_type = ANY(allowed_types)) THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || jsonb_build_array('Invalid file type: ' || file_type));
  END IF;
  
  -- Enhanced filename validation
  IF file_name ~ '\.\.|\/|\\|\0|<|>|\||\*|\?|:|"' THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["Invalid characters in filename"]'::jsonb);
  END IF;
  
  -- Check file extension matches content type
  IF file_name ~ '\.(exe|bat|cmd|scr|vbs|js)$' THEN
    result := jsonb_set(result, '{valid}', 'false'::jsonb);
    result := jsonb_set(result, '{errors}', result->'errors' || '["Potentially dangerous file extension"]'::jsonb);
  END IF;
  
  -- Content inspection if sample provided
  IF file_content_sample IS NOT NULL THEN
    FOREACH pattern IN ARRAY malicious_patterns LOOP
      IF lower(file_content_sample) LIKE '%' || pattern || '%' THEN
        result := jsonb_set(result, '{valid}', 'false'::jsonb);
        result := jsonb_set(result, '{errors}', result->'errors' || jsonb_build_array('Potentially malicious content detected: ' || pattern));
      END IF;
    END LOOP;
  END IF;
  
  -- Rate limiting check (simplified)
  IF EXISTS (
    SELECT 1 FROM audit_logs 
    WHERE table_name = 'file_uploads' 
      AND user_email = (SELECT email FROM auth.users WHERE id = user_id)
      AND timestamp > NOW() - INTERVAL '1 hour'
    HAVING COUNT(*) > 10
  ) THEN
    result := jsonb_set(result, '{warnings}', result->'warnings' || '["High upload frequency detected"]'::jsonb);
  END IF;
  
  -- Log validation attempt with enhanced details
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('file_uploads', 'VALIDATE_ENHANCED', gen_random_uuid()::text, 
          jsonb_build_object(
            'file_name', file_name, 
            'file_size', file_size, 
            'file_type', file_type,
            'has_content_sample', file_content_sample IS NOT NULL,
            'result', result
          ),
          COALESCE((SELECT email FROM auth.users WHERE id = user_id), 'anonymous'), 
          CASE WHEN (result->>'valid')::boolean THEN 'info' ELSE 'warning' END);
  
  RETURN result;
END;
$function$;

-- 4. Create security monitoring functions
-- =================================================================

CREATE OR REPLACE FUNCTION public.detect_suspicious_activity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  suspicious_logins integer;
  failed_uploads integer;
  unusual_access integer;
  result jsonb;
BEGIN
  -- Count suspicious login attempts (5+ failures in 10 minutes)
  SELECT COUNT(DISTINCT email) INTO suspicious_logins
  FROM login_attempts 
  WHERE success = false 
    AND timestamp > NOW() - INTERVAL '10 minutes'
  GROUP BY email 
  HAVING COUNT(*) >= 5;
  
  -- Count failed uploads in last hour
  SELECT COUNT(*) INTO failed_uploads
  FROM audit_logs 
  WHERE table_name = 'file_uploads' 
    AND severity = 'warning'
    AND timestamp > NOW() - INTERVAL '1 hour';
  
  -- Count unusual data access patterns
  SELECT COUNT(*) INTO unusual_access
  FROM data_access_logs 
  WHERE sensitive_data_accessed = true
    AND timestamp > NOW() - INTERVAL '1 hour';
  
  result := jsonb_build_object(
    'suspicious_logins', COALESCE(suspicious_logins, 0),
    'failed_uploads', COALESCE(failed_uploads, 0),
    'unusual_access', COALESCE(unusual_access, 0),
    'risk_level', CASE 
      WHEN COALESCE(suspicious_logins, 0) > 0 OR COALESCE(unusual_access, 0) > 10 THEN 'HIGH'
      WHEN COALESCE(failed_uploads, 0) > 5 THEN 'MEDIUM'
      ELSE 'LOW'
    END,
    'timestamp', NOW()
  );
  
  -- Create alert if high risk
  IF (result->>'risk_level') = 'HIGH' THEN
    PERFORM create_security_alert(
      'suspicious_activity',
      'high',
      'Suspicious Activity Detected',
      'Multiple security indicators triggered: ' || result::text,
      result
    );
  END IF;
  
  RETURN result;
END;
$function$;

-- 5. Update security validation function to reflect new status
-- =================================================================

CREATE OR REPLACE FUNCTION public.validate_security_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  rls_enabled_count integer;
  functions_with_search_path integer;
  permissive_policies_count integer;
  security_definer_views integer;
BEGIN
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND rowsecurity = true;
  
  -- Count functions with proper search_path
  SELECT COUNT(*) INTO functions_with_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proconfig @> ARRAY['search_path=public'];
  
  -- Count potentially permissive policies
  SELECT COUNT(*) INTO permissive_policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true');
  
  -- Count SECURITY DEFINER views (these should be minimal)
  SELECT COUNT(*) INTO security_definer_views
  FROM pg_views v
  JOIN pg_rewrite r ON r.ev_class = (v.schemaname||'.'||v.viewname)::regclass
  WHERE v.schemaname = 'public'
    AND r.ev_action::text LIKE '%SECURITY DEFINER%';
  
  result := jsonb_build_object(
    'rls_enabled_tables', rls_enabled_count,
    'secure_functions', functions_with_search_path,
    'permissive_policies', permissive_policies_count,
    'security_definer_views', COALESCE(security_definer_views, 0),
    'security_score', CASE 
      WHEN permissive_policies_count = 0 AND rls_enabled_count > 50 AND functions_with_search_path > 45
        THEN 9
      WHEN permissive_policies_count <= 2 AND rls_enabled_count > 30 AND functions_with_search_path > 30
        THEN 8
      WHEN permissive_policies_count <= 5 AND rls_enabled_count > 20
        THEN 7
      ELSE 6
    END,
    'timestamp', NOW(),
    'critical_issues', jsonb_build_array(
      CASE WHEN permissive_policies_count > 0 
        THEN 'Permissive RLS policies found: ' || permissive_policies_count
        ELSE NULL END,
      CASE WHEN security_definer_views > 0
        THEN 'Security definer views found: ' || security_definer_views  
        ELSE NULL END
    ) - 'null'::jsonb,
    'recommendations', CASE
      WHEN permissive_policies_count = 0 AND security_definer_views = 0
        THEN jsonb_build_array('Security configuration significantly improved')
      ELSE jsonb_build_array(
        'Review remaining permissive policies',
        'Implement field-level access controls',
        'Add automated security monitoring'
      )
    END
  );
  
  -- Log security validation
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('security_config', 'VALIDATION', gen_random_uuid()::text, result,
          'system', 'info');
  
  RETURN result;
END;
$function$;

-- 6. Create automated security health check
-- =================================================================

CREATE OR REPLACE FUNCTION public.run_security_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  config_result jsonb;
  activity_result jsonb;
  combined_result jsonb;
BEGIN
  -- Run configuration validation
  SELECT validate_security_configuration() INTO config_result;
  
  -- Run suspicious activity detection  
  SELECT detect_suspicious_activity() INTO activity_result;
  
  -- Combine results
  combined_result := jsonb_build_object(
    'configuration', config_result,
    'activity_monitoring', activity_result,
    'overall_status', CASE
      WHEN (config_result->>'security_score')::integer >= 8 AND (activity_result->>'risk_level') = 'LOW'
        THEN 'EXCELLENT'
      WHEN (config_result->>'security_score')::integer >= 6 AND (activity_result->>'risk_level') IN ('LOW', 'MEDIUM')
        THEN 'GOOD' 
      ELSE 'NEEDS_ATTENTION'
    END,
    'last_check', NOW()
  );
  
  RETURN combined_result;
END;
$function$;

-- Run final security validation
SELECT public.run_security_health_check();
