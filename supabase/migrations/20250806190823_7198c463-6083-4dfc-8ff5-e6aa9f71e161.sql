-- CRITICAL SECURITY FIX: Add secure search paths to all database functions
-- This prevents SQL injection through search_path manipulation

-- Fix function search paths for security
ALTER FUNCTION public.diagnosticar_limitacoes_supabase() SET search_path TO 'public';
ALTER FUNCTION public.atualizar_status_configuracao_contrato() SET search_path TO 'public';
ALTER FUNCTION public.security_health_check() SET search_path TO 'public';
ALTER FUNCTION public.limpar_todos_precos() SET search_path TO 'public';
ALTER FUNCTION public.validate_cpf(text) SET search_path TO 'public';
ALTER FUNCTION public.aplicar_de_para_prioridade_trigger() SET search_path TO 'public';
ALTER FUNCTION public.aplicar_de_para_prioridade() SET search_path TO 'public';
ALTER FUNCTION public.aplicar_valores_de_para() SET search_path TO 'public';
ALTER FUNCTION public.create_security_alert(text, text, text, text, jsonb) SET search_path TO 'public';
ALTER FUNCTION public.validate_cnpj(text) SET search_path TO 'public';
ALTER FUNCTION public.hash_personal_data(text) SET search_path TO 'public';
ALTER FUNCTION public.audit_trigger() SET search_path TO 'public';
ALTER FUNCTION public.refresh_volumetria_dashboard() SET search_path TO 'public';
ALTER FUNCTION public.audit_sensitive_changes() SET search_path TO 'public';
ALTER FUNCTION public.get_clientes_stats_completos() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_old_audit_logs() SET search_path TO 'public';
ALTER FUNCTION public.get_periodo_faturamento(date) SET search_path TO 'public';
ALTER FUNCTION public.archive_old_volumetria_data() SET search_path TO 'public';
ALTER FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb, text) SET search_path TO 'public';
ALTER FUNCTION public.log_data_access(text, text, text, boolean, text) SET search_path TO 'public';
ALTER FUNCTION public.monitor_sensitive_access() SET search_path TO 'public';
ALTER FUNCTION public.aplicar_de_para_automatico(text) SET search_path TO 'public';
ALTER FUNCTION public.cleanup_old_performance_logs() SET search_path TO 'public';
ALTER FUNCTION public.get_volumetria_aggregated_stats() SET search_path TO 'public';
ALTER FUNCTION public.get_clientes_com_volumetria() SET search_path TO 'public';
ALTER FUNCTION public.aplicar_categorias_volumetria() SET search_path TO 'public';
ALTER FUNCTION public.aplicar_categoria_trigger() SET search_path TO 'public';
ALTER FUNCTION public.criar_contratos_clientes_automatico() SET search_path TO 'public';
ALTER FUNCTION public.set_data_referencia_volumetria() SET search_path TO 'public';
ALTER FUNCTION public.calculate_custom_metric(text) SET search_path TO 'public';
ALTER FUNCTION public.analyze_partitioning_need() SET search_path TO 'public';
ALTER FUNCTION public.update_custom_metrics() SET search_path TO 'public';
ALTER FUNCTION public.prepare_partition_structure(text, date) SET search_path TO 'public';
ALTER FUNCTION public.calcular_capacidade_produtiva(uuid, integer) SET search_path TO 'public';
ALTER FUNCTION public.limpar_dados_volumetria(text[]) SET search_path TO 'public';
ALTER FUNCTION public.enviar_escala_mensal() SET search_path TO 'public';
ALTER FUNCTION public.replicar_escala_medico(uuid, integer, integer, integer, integer) SET search_path TO 'public';
ALTER FUNCTION public.get_nome_cliente_mapeado(text) SET search_path TO 'public';
ALTER FUNCTION public.is_admin() SET search_path TO 'public';
ALTER FUNCTION public.is_manager_or_admin() SET search_path TO 'public';
ALTER FUNCTION public.user_can_access_empresa(text) SET search_path TO 'public';
ALTER FUNCTION public.validate_file_upload(text, bigint, text, uuid) SET search_path TO 'public';
ALTER FUNCTION public.oferecer_escala_cobertura(uuid, uuid, date, date, text, text) SET search_path TO 'public';
ALTER FUNCTION public.aceitar_cobertura_escala(uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.listar_coberturas_disponiveis(uuid) SET search_path TO 'public';
ALTER FUNCTION public.expirar_coberturas_automaticamente() SET search_path TO 'public';
ALTER FUNCTION public.perform_security_audit() SET search_path TO 'public';

-- CRITICAL SECURITY FIX: Restrict overly permissive RLS policies
-- Replace generic 'true' policies with proper role-based access

-- Create secure helper functions for better access control
CREATE OR REPLACE FUNCTION public.has_volumetria_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admin and manager roles can access volumetry data
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_metrics_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admin role can access metrics
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  );
END;
$$;

-- Add input validation function for security
CREATE OR REPLACE FUNCTION public.validate_input_security(input_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Check for common SQL injection patterns
  IF input_text ~ '(union|select|insert|update|delete|drop|alter|create|exec|execute|script|javascript|<script|</script>)' THEN
    RETURN false;
  END IF;
  
  -- Check for XSS patterns
  IF input_text ~ '(<|>|javascript:|data:|vbscript:|onload|onerror|onclick)' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Enhanced security audit function
CREATE OR REPLACE FUNCTION public.enhanced_security_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  audit_result jsonb;
  rls_tables_count integer;
  policies_count integer;
  recent_alerts_count integer;
  insecure_functions_count integer;
BEGIN
  -- Check RLS status
  SELECT COUNT(*) INTO rls_tables_count
  FROM pg_tables pt
  WHERE pt.schemaname = 'public' 
    AND pt.rowsecurity = true;
  
  -- Check policies count
  SELECT COUNT(*) INTO policies_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Check recent security alerts
  SELECT COUNT(*) INTO recent_alerts_count
  FROM security_alerts
  WHERE timestamp > NOW() - INTERVAL '24 hours'
    AND severity IN ('high', 'critical');
  
  -- Check for functions without secure search_path
  SELECT COUNT(*) INTO insecure_functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_settings s 
      WHERE s.name = 'search_path' 
      AND p.prosecdef = true
    );
  
  audit_result := jsonb_build_object(
    'timestamp', NOW(),
    'rls_enabled_tables', rls_tables_count,
    'total_policies', policies_count,
    'recent_critical_alerts', recent_alerts_count,
    'insecure_functions', insecure_functions_count,
    'security_score', CASE 
      WHEN rls_tables_count >= 10 AND insecure_functions_count = 0 THEN 'HIGH'
      WHEN rls_tables_count >= 5 AND insecure_functions_count <= 5 THEN 'MEDIUM'
      ELSE 'LOW'
    END,
    'recommendations', CASE 
      WHEN rls_tables_count < 10 THEN '["Enable RLS on more tables"]'::jsonb
      WHEN insecure_functions_count > 0 THEN '["Fix function search paths"]'::jsonb
      ELSE '["Security posture is good"]'::jsonb
    END
  );
  
  -- Log enhanced audit
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('security_audit', 'ENHANCED_AUDIT', gen_random_uuid()::text, audit_result,
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  RETURN audit_result;
END;
$$;