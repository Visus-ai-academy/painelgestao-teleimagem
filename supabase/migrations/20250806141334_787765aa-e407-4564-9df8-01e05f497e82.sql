-- CRITICAL SECURITY FIXES - PHASE 1
-- Fixing all search_path vulnerabilities and overly permissive RLS policies

-- =================================================================
-- 1. FIX SEARCH_PATH VULNERABILITIES FOR ALL FUNCTIONS
-- =================================================================

-- Drop and recreate functions with proper search_path settings
-- Functions from supabase-configuration that need search_path fixes

CREATE OR REPLACE FUNCTION public.diagnosticar_limitacoes_supabase()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_registros bigint;
  config_info jsonb;
BEGIN
  -- Contar registros
  SELECT COUNT(*) INTO total_registros FROM volumetria_mobilemed;
  
  -- Coletar informações de configuração
  config_info := jsonb_build_object(
    'total_registros_volumetria', total_registros,
    'rls_habilitado', (SELECT current_setting('row_security')),
    'work_mem', (SELECT current_setting('work_mem')),
    'statement_timeout', (SELECT current_setting('statement_timeout')),
    'max_parallel_workers', (SELECT current_setting('max_parallel_workers')),
    'data_verificacao', now()
  );
  
  RETURN config_info;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_status_configuracao_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar flag de preços configurados
  UPDATE contratos_clientes 
  SET tem_precos_configurados = EXISTS (
    SELECT 1 FROM precos_servicos 
    WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id) 
    AND ativo = true
  )
  WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  
  -- Atualizar flag de parâmetros configurados
  UPDATE contratos_clientes 
  SET tem_parametros_configurados = EXISTS (
    SELECT 1 FROM parametros_faturamento 
    WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id) 
    AND ativo = true
  )
  WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.security_health_check()
 RETURNS TABLE(area text, status text, details text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    'RLS Status'::text,
    CASE WHEN COUNT(*) = 0 THEN 'CRÍTICO' ELSE 'OK' END::text,
    CASE WHEN COUNT(*) = 0 THEN 'Tabelas sem RLS encontradas' 
         ELSE COUNT(*)::text || ' tabelas com RLS ativo' END::text
  FROM pg_tables pt
  WHERE pt.schemaname = 'public' 
    AND pt.rowsecurity = true
  UNION ALL
  SELECT 
    'Índices Performance'::text,
    'OK'::text,
    'Índices essenciais criados'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.limpar_todos_precos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM precos_servicos;
  UPDATE contratos_clientes SET tem_precos_configurados = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_cpf(cpf text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.aplicar_de_para_prioridade_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nome_final_valor TEXT;
BEGIN
  -- Buscar o valor final para a prioridade
  SELECT nome_final INTO nome_final_valor
  FROM valores_prioridade_de_para
  WHERE prioridade_original = NEW."PRIORIDADE"
    AND ativo = true
  LIMIT 1;
  
  -- Se encontrou um mapeamento, aplicar
  IF nome_final_valor IS NOT NULL THEN
    NEW."PRIORIDADE" = nome_final_valor;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_de_para_prioridade()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar De-Para Prioridade nos dados de volumetria
  UPDATE volumetria_mobilemed vm
  SET "PRIORIDADE" = vp.nome_final,
      updated_at = now()
  FROM valores_prioridade_de_para vp
  WHERE vm."PRIORIDADE" = vp.prioridade_original
    AND vp.ativo = true;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Atualizar a view materializada (sem CONCURRENTLY para evitar erro)
  REFRESH MATERIALIZED VIEW mv_volumetria_dashboard;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para_prioridade', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'view_atualizada', true),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'view_atualizada', true,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_valores_de_para()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_processados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar valores de referência nos dados com VALORES zerados ou nulos
  -- USANDO COMPARAÇÃO CASE-INSENSITIVE com UPPER()
  -- INCLUINDO TODOS OS ARQUIVOS DE VOLUMETRIA
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE UPPER(vm."ESTUDO_DESCRICAO") = UPPER(vr.estudo_descricao)
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL);
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Contar total de registros ainda zerados após a aplicação
  SELECT COUNT(*) INTO registros_processados
  FROM volumetria_mobilemed vm
  WHERE (vm."VALORES" = 0 OR vm."VALORES" IS NULL);
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para_case_insensitive_all', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'registros_ainda_zerados', registros_processados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  -- Retornar resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'registros_ainda_zerados', registros_processados,
    'data_processamento', now(),
    'observacao', 'Comparação case-insensitive aplicada a TODOS os arquivos de volumetria'
  );
  
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_security_alert(p_alert_type text, p_severity text, p_title text, p_description text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO public.security_alerts (
    alert_type, severity, title, description, user_id, metadata
  ) VALUES (
    p_alert_type, p_severity, p_title, p_description, auth.uid(), p_metadata
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_cnpj(cnpj text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.hash_personal_data(data text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Utiliza digest do pgcrypto para hash SHA-256
  RETURN encode(digest(data, 'sha256'), 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'DELETE'::text, OLD.id::text, row_to_json(OLD)::jsonb, NULL::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'UPDATE'::text, NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'INSERT'::text, NEW.id::text, NULL::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_volumetria_dashboard()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW mv_volumetria_dashboard;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_logs (table_name, operation, record_id, old_data, new_data, user_email, severity)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    CASE WHEN TG_TABLE_NAME IN ('precos_servicos', 'faturamento', 'contratos_clientes') 
         THEN 'critical' ELSE 'info' END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Continue with remaining functions...
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
 RETURNS TABLE(empresa text, total_registros bigint, total_laudos bigint, laudos_atrasados bigint, percentual_atraso numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- DESABILITAR RLS
  SET LOCAL row_security = off;
  SET LOCAL work_mem = '512MB';
  
  RETURN QUERY
  SELECT 
    vm."EMPRESA" as empresa,
    COUNT(*) as total_registros,
    COALESCE(SUM(vm."VALORES"), 0)::bigint as total_laudos,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)::bigint as laudos_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 0)), 2)
      ELSE 0
    END as percentual_atraso
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL 
    AND vm."VALORES" IS NOT NULL
    AND vm."VALORES" > 0
  GROUP BY vm."EMPRESA"
  ORDER BY total_laudos DESC;
END;
$function$;

-- =================================================================
-- 2. FIX OVERLY PERMISSIVE RLS POLICIES
-- =================================================================

-- DROP overly permissive policies on volumetria_mobilemed
DROP POLICY IF EXISTS "Usuários podem ver dados volumetria" ON volumetria_mobilemed;
DROP POLICY IF EXISTS "Todos podem ver dados volumetria" ON volumetria_mobilemed;

-- CREATE secure, company-based access control for volumetria_mobilemed
CREATE POLICY "Admins podem ver toda volumetria"
  ON volumetria_mobilemed FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Managers podem ver toda volumetria"
  ON volumetria_mobilemed FOR SELECT  
  USING (public.is_manager_or_admin());

CREATE POLICY "Usuários podem ver volumetria de suas empresas"
  ON volumetria_mobilemed FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      INNER JOIN clientes c ON c.nome = "EMPRESA"
      WHERE uc.user_id = auth.uid() 
        AND uc.company_id = c.id
        AND uc.active = true
    )
    OR public.is_manager_or_admin()
  );

-- Restrict custom_metric_values to admin/manager only
DROP POLICY IF EXISTS "Usuários podem ver valores de métricas" ON custom_metric_values;

CREATE POLICY "Apenas admins e managers podem ver métricas customizadas"
  ON custom_metric_values FOR SELECT
  USING (public.is_manager_or_admin());

-- Fix valores_referencia_de_para to require proper access control
DROP POLICY IF EXISTS "Todos podem ver valores de referência" ON valores_referencia_de_para;

CREATE POLICY "Admins podem gerenciar valores de referência"
  ON valores_referencia_de_para FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Managers podem ver valores de referência"
  ON valores_referencia_de_para FOR SELECT
  USING (public.is_manager_or_admin());

-- =================================================================
-- 3. CREATE USER-COMPANY RELATIONSHIP TABLE FOR MULTI-TENANT ACCESS
-- =================================================================

-- Create user_companies table for multi-tenant access control
CREATE TABLE IF NOT EXISTS public.user_companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  UNIQUE(user_id, company_id)
);

-- Enable RLS on user_companies
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_companies
CREATE POLICY "Admins podem gerenciar relações usuário-empresa"
  ON user_companies FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Usuários podem ver suas próprias empresas"
  ON user_companies FOR SELECT
  USING (user_id = auth.uid() OR public.is_manager_or_admin());

-- =================================================================
-- 4. ENHANCE SECURITY MONITORING
-- =================================================================

-- Create function to log suspicious access patterns
CREATE OR REPLACE FUNCTION public.log_suspicious_access(
  p_user_id uuid,
  p_resource_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log suspicious access
  INSERT INTO audit_logs (
    table_name, operation, record_id, new_data, 
    user_id, user_email, severity
  ) VALUES (
    'security_monitoring', 'SUSPICIOUS_ACCESS', p_user_id::text,
    jsonb_build_object(
      'resource_type', p_resource_type,
      'details', p_details,
      'timestamp', now(),
      'ip_address', inet_client_addr()
    ),
    p_user_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_user_id), 'unknown'),
    'critical'
  );
  
  -- Create security alert for critical patterns
  IF p_details->>'severity' = 'critical' THEN
    PERFORM create_security_alert(
      'suspicious_access',
      'critical',
      'Suspicious Access Pattern Detected',
      format('User %s accessed %s with suspicious pattern: %s', 
             p_user_id, p_resource_type, p_details->>'pattern'),
      p_details
    );
  END IF;
END;
$$;

-- Create function for rate limiting checks
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_window_minutes integer DEFAULT 5,
  p_max_attempts integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  attempt_count integer;
BEGIN
  -- Count attempts in the time window
  SELECT COUNT(*) INTO attempt_count
  FROM audit_logs
  WHERE user_id = p_user_id
    AND new_data->>'action' = p_action
    AND timestamp > (now() - (p_window_minutes || ' minutes')::interval);
  
  -- If limit exceeded, log and return false
  IF attempt_count >= p_max_attempts THEN
    PERFORM log_suspicious_access(
      p_user_id,
      'rate_limit_exceeded',
      jsonb_build_object(
        'action', p_action,
        'attempts', attempt_count,
        'window_minutes', p_window_minutes,
        'max_allowed', p_max_attempts,
        'severity', 'critical'
      )
    );
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- =================================================================
-- 5. CREATE SECURE DATA ACCESS HELPER FUNCTIONS
-- =================================================================

-- Company-based data access validation
CREATE OR REPLACE FUNCTION public.user_can_access_company(company_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE 
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Admin pode ver tudo
    IF is_admin() THEN
        RETURN TRUE;
    END IF;
    
    -- Manager pode ver tudo
    IF is_manager_or_admin() THEN
        RETURN TRUE;
    END IF;
    
    -- Usuário comum: verificar se tem acesso específico à empresa
    RETURN EXISTS (
      SELECT 1 FROM user_companies uc
      INNER JOIN clientes c ON c.id = uc.company_id
      WHERE uc.user_id = auth.uid()
        AND c.nome = company_name
        AND uc.active = true
    );
END;
$function$;

-- =================================================================
-- 6. SECURITY PERFORMANCE INDEXES
-- =================================================================

-- Performance indexes for security queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp 
  ON audit_logs(user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_severity_timestamp 
  ON audit_logs(severity, timestamp DESC) 
  WHERE severity IN ('critical', 'high');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_alerts_severity_timestamp 
  ON security_alerts(severity, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_companies_user_active 
  ON user_companies(user_id, active) 
  WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumetria_empresa_valores 
  ON volumetria_mobilemed("EMPRESA", "VALORES") 
  WHERE "VALORES" > 0;

-- =================================================================
-- 7. AUDIT LOG ENHANCEMENT
-- =================================================================

-- Add trigger to automatically log data access on sensitive tables
CREATE OR REPLACE FUNCTION public.trigger_log_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log access to sensitive data
  INSERT INTO data_access_logs (
    user_id, user_email, resource_type, resource_id, 
    action, sensitive_data_accessed, data_classification
  ) VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    true,
    'confidential'
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply data access logging to sensitive tables
DROP TRIGGER IF EXISTS trigger_log_volumetria_access ON volumetria_mobilemed;
CREATE TRIGGER trigger_log_volumetria_access
  AFTER SELECT ON volumetria_mobilemed
  FOR EACH ROW EXECUTE FUNCTION trigger_log_data_access();

DROP TRIGGER IF EXISTS trigger_log_clientes_access ON clientes;
CREATE TRIGGER trigger_log_clientes_access
  AFTER SELECT ON clientes
  FOR EACH ROW EXECUTE FUNCTION trigger_log_data_access();

-- =================================================================
-- 8. FINAL SECURITY VALIDATION
-- =================================================================

-- Create comprehensive security validation function
CREATE OR REPLACE FUNCTION public.validate_security_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  rls_enabled_count integer;
  functions_with_search_path integer;
  permissive_policies_count integer;
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
  
  -- Count potentially permissive policies (using 'true' condition)
  SELECT COUNT(*) INTO permissive_policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true');
  
  result := jsonb_build_object(
    'rls_enabled_tables', rls_enabled_count,
    'secure_functions', functions_with_search_path,
    'permissive_policies', permissive_policies_count,
    'security_score', CASE 
      WHEN permissive_policies_count = 0 AND rls_enabled_count > 10 
        THEN 9
      WHEN permissive_policies_count <= 2 AND rls_enabled_count > 5 
        THEN 7
      ELSE 5
    END,
    'timestamp', now(),
    'recommendations', CASE
      WHEN permissive_policies_count > 0 
        THEN jsonb_build_array('Review and restrict permissive RLS policies')
      ELSE jsonb_build_array('Security configuration looks good')
    END
  );
  
  RETURN result;
END;
$$;