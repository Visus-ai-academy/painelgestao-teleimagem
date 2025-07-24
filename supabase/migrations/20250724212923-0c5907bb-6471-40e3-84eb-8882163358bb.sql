-- PHASE 1: CRITICAL DATABASE SECURITY FIXES

-- 1. Enable RLS on volumetria_mobilemed_archive table
ALTER TABLE volumetria_mobilemed_archive ENABLE ROW LEVEL SECURITY;

-- 2. Create proper RLS policies for archive table (matching main table security)
CREATE POLICY "Proteção temporal - SELECT archive" 
ON volumetria_mobilemed_archive 
FOR SELECT 
USING (can_view_data(data_referencia) AND is_manager_or_admin());

CREATE POLICY "Admins podem gerenciar archive" 
ON volumetria_mobilemed_archive 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 3. Fix database function security - Add search_path to all functions
CREATE OR REPLACE FUNCTION public.set_data_referencia_volumetria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Define data_referencia baseado no tipo de arquivo
  IF NEW.arquivo_fonte = 'data_laudo' THEN
    NEW.data_referencia = NEW."DATA_LAUDO";
  ELSIF NEW.arquivo_fonte = 'data_exame' THEN
    NEW.data_referencia = NEW."DATA_REALIZACAO";
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_periodo_faturamento(data_referencia date)
RETURNS TABLE(inicio_periodo date, fim_periodo date, mes_referencia text, ano_referencia integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inicio_periodo_var DATE;
  fim_periodo_var DATE;
  mes_ref INTEGER;
  ano_ref INTEGER;
BEGIN
  -- Se a data for antes do dia 8, o período é do mês anterior
  IF EXTRACT(DAY FROM data_referencia) < 8 THEN
    -- Período: dia 8 do mês anterior ao anterior até dia 7 do mês anterior
    inicio_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '2 months')::DATE + INTERVAL '7 days';
    fim_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '1 month')::DATE + INTERVAL '6 days';
    mes_ref := EXTRACT(MONTH FROM data_referencia - INTERVAL '2 months');
    ano_ref := EXTRACT(YEAR FROM data_referencia - INTERVAL '2 months');
  ELSE
    -- Período: dia 8 do mês anterior até dia 7 do mês atual
    inicio_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '1 month')::DATE + INTERVAL '7 days';
    fim_periodo_var := DATE_TRUNC('month', data_referencia)::DATE + INTERVAL '6 days';
    mes_ref := EXTRACT(MONTH FROM data_referencia - INTERVAL '1 month');
    ano_ref := EXTRACT(YEAR FROM data_referencia - INTERVAL '1 month');
  END IF;
  
  RETURN QUERY SELECT 
    inicio_periodo_var,
    fim_periodo_var,
    CASE mes_ref
      WHEN 1 THEN 'Janeiro'
      WHEN 2 THEN 'Fevereiro'
      WHEN 3 THEN 'Março'
      WHEN 4 THEN 'Abril'
      WHEN 5 THEN 'Maio'
      WHEN 6 THEN 'Junho'
      WHEN 7 THEN 'Julho'
      WHEN 8 THEN 'Agosto'
      WHEN 9 THEN 'Setembro'
      WHEN 10 THEN 'Outubro'
      WHEN 11 THEN 'Novembro'
      WHEN 12 THEN 'Dezembro'
    END || '/' || SUBSTRING(ano_ref::TEXT FROM 3),
    ano_ref;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_volumetria_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_volumetria_dashboard;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_event(p_table_name text, p_operation text, p_record_id text, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb, p_severity text DEFAULT 'info'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    table_name, operation, record_id, old_data, new_data, 
    user_id, user_email, severity, session_id
  ) VALUES (
    p_table_name, p_operation, p_record_id, p_old_data, p_new_data,
    auth.uid(), 
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    p_severity,
    COALESCE(current_setting('app.session_id', true), gen_random_uuid()::text)
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_data_access(p_resource_type text, p_resource_id text DEFAULT NULL::text, p_action text DEFAULT 'SELECT'::text, p_sensitive boolean DEFAULT false, p_classification text DEFAULT 'public'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.data_access_logs (
    user_id, user_email, resource_type, resource_id, action,
    sensitive_data_accessed, data_classification
  ) VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'anonymous'),
    p_resource_type, p_resource_id, p_action, p_sensitive, p_classification
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
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

-- 4. Strengthen Password Policies
UPDATE password_policies SET 
  min_length = 12,
  require_uppercase = true,
  require_lowercase = true,
  require_numbers = true,
  require_symbols = true,
  max_attempts = 3,
  lockout_duration_minutes = 60,
  max_age_days = 60,
  history_count = 10;

-- 5. Fix overly permissive RLS policies on critical tables

-- Update clientes policies to be more restrictive
DROP POLICY IF EXISTS "Usuários autenticados podem ver clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar clientes" ON clientes;

CREATE POLICY "Managers podem gerenciar clientes" 
ON clientes 
FOR ALL 
USING (is_manager_or_admin()) 
WITH CHECK (is_manager_or_admin());

CREATE POLICY "Usuários podem visualizar clientes" 
ON clientes 
FOR SELECT 
USING (true);

-- Update pendencias policies
DROP POLICY IF EXISTS "Todos podem ver pendências" ON pendencias;

CREATE POLICY "Usuários podem ver pendências públicas" 
ON pendencias 
FOR SELECT 
USING (categoria != 'confidencial' OR is_manager_or_admin());

-- Create security monitoring triggers
CREATE OR REPLACE FUNCTION public.monitor_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log access to sensitive tables
  IF TG_TABLE_NAME IN ('clientes', 'medicos', 'faturamento', 'contratos_clientes') THEN
    PERFORM log_data_access(TG_TABLE_NAME::text, NEW.id::text, TG_OP::text, true, 'confidential');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Apply monitoring to sensitive tables
DROP TRIGGER IF EXISTS monitor_clientes_access ON clientes;
CREATE TRIGGER monitor_clientes_access
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION monitor_sensitive_access();

DROP TRIGGER IF EXISTS monitor_medicos_access ON medicos;
CREATE TRIGGER monitor_medicos_access
  AFTER INSERT OR UPDATE OR DELETE ON medicos
  FOR EACH ROW EXECUTE FUNCTION monitor_sensitive_access();