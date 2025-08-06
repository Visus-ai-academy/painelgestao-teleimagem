-- CRITICAL SECURITY FIXES - PHASE 1 (CORRECTED)
-- Fixing remaining functions with search_path and removing invalid triggers

-- =================================================================
-- 1. FIX REMAINING FUNCTIONS WITH SEARCH_PATH VULNERABILITIES
-- =================================================================

-- Fix all remaining functions that need search_path
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove logs mais antigos que 90 dias
  DELETE FROM audit_logs 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
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

CREATE OR REPLACE FUNCTION public.archive_old_volumetria_data()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    archived_count INTEGER;
    cutoff_date DATE;
BEGIN
    -- Data limite: 2 anos atrás
    cutoff_date := CURRENT_DATE - INTERVAL '2 years';
    
    -- Mover dados antigos para tabela de arquivo
    WITH moved_data AS (
        DELETE FROM volumetria_mobilemed 
        WHERE data_referencia < cutoff_date
        RETURNING *
    )
    INSERT INTO volumetria_mobilemed_archive 
    SELECT * FROM moved_data;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Log da operação
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'ARCHIVE', 'bulk', 
            jsonb_build_object('archived_count', archived_count, 'cutoff_date', cutoff_date),
            'system', 'info');
    
    RETURN archived_count;
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

CREATE OR REPLACE FUNCTION public.aplicar_de_para_automatico(arquivo_fonte_param text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar valores de referência nos dados com VALORES zerados ou nulos do arquivo específico
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE vm."ESTUDO_DESCRICAO" = vr.estudo_descricao
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte = arquivo_fonte_param;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'de_para_automatico', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'arquivo_fonte', arquivo_fonte_param),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  -- Retornar resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'arquivo_fonte', arquivo_fonte_param,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_performance_logs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM performance_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log da limpeza
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('performance_logs', 'CLEANUP', 'bulk', 
            jsonb_build_object('deleted_count', deleted_count),
            'system', 'info');
    
    RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_volumetria_aggregated_stats()
 RETURNS TABLE(arquivo_fonte text, total_records numeric, records_with_value numeric, records_zeroed numeric, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm.arquivo_fonte,
    COUNT(*)::numeric as total_records,
    COUNT(*) FILTER (WHERE vm."VALORES" > 0)::numeric as records_with_value,
    COUNT(*) FILTER (WHERE vm."VALORES" = 0 OR vm."VALORES" IS NULL)::numeric as records_zeroed,
    COALESCE(SUM(vm."VALORES"), 0)::numeric as total_value
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN (
    'volumetria_padrao', 
    'volumetria_fora_padrao', 
    'volumetria_padrao_retroativo', 
    'volumetria_fora_padrao_retroativo',
    'volumetria_onco_padrao',
    'data_laudo',
    'data_exame'
  )
  GROUP BY vm.arquivo_fonte;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_clientes_com_volumetria()
 RETURNS TABLE(id uuid, nome text, endereco text, cidade text, estado text, status text, ativo boolean, contato text, telefone text, email text, cnpj text, volume_exames bigint, total_registros bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.endereco,
    c.cidade,
    c.estado,
    c.status,
    c.ativo,
    c.contato,
    c.telefone,
    c.email,
    c.cnpj,
    COALESCE(v.volume_exames, 0) as volume_exames,
    COALESCE(v.total_registros, 0) as total_registros
  FROM clientes c
  LEFT JOIN (
    SELECT 
      "EMPRESA",
      SUM("VALORES") as volume_exames,
      COUNT(*) as total_registros
    FROM volumetria_mobilemed 
    WHERE "EMPRESA" IS NOT NULL 
    GROUP BY "EMPRESA"
  ) v ON c.nome = v."EMPRESA"
  WHERE c.ativo = true
  ORDER BY v.volume_exames DESC NULLS LAST;
END;
$function$;

-- Fix all other functions with search_path issues
CREATE OR REPLACE FUNCTION public.aplicar_categorias_volumetria()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_sc INTEGER := 0;
  resultado JSONB;
BEGIN
  -- 1. Aplicar categoria do cadastro de exames (match exato por ESTUDO_DESCRICAO)
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = ce.categoria,
      updated_at = now()
  FROM cadastro_exames ce
  WHERE vm."ESTUDO_DESCRICAO" = ce.nome
    AND ce.ativo = true
    AND ce.categoria IS NOT NULL
    AND ce.categoria != '';
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- 2. Aplicar categoria das regras de quebra (para exames quebrados)
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = rqe.categoria_quebrada,
      updated_at = now()
  FROM regras_quebra_exames rqe
  WHERE vm."ESTUDO_DESCRICAO" = rqe.exame_quebrado
    AND rqe.ativo = true
    AND rqe.categoria_quebrada IS NOT NULL
    AND rqe.categoria_quebrada != ''
    AND vm."CATEGORIA" IS NULL;
  
  -- 3. Definir "SC" para exames sem categoria identificada
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = 'SC',
      updated_at = now()
  WHERE vm."CATEGORIA" IS NULL OR vm."CATEGORIA" = '';
  
  GET DIAGNOSTICS registros_sc = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'aplicar_categorias', 
          jsonb_build_object(
            'registros_com_categoria', registros_atualizados, 
            'registros_sem_categoria', registros_sc
          ),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_com_categoria', registros_atualizados,
    'registros_sem_categoria', registros_sc,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_categoria_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Tentar buscar categoria do cadastro de exames
  SELECT ce.categoria INTO NEW."CATEGORIA"
  FROM cadastro_exames ce
  WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
    AND ce.ativo = true
    AND ce.categoria IS NOT NULL
    AND ce.categoria != ''
  LIMIT 1;
  
  -- Se não encontrou, tentar buscar nas regras de quebra
  IF NEW."CATEGORIA" IS NULL THEN
    SELECT rqe.categoria_quebrada INTO NEW."CATEGORIA"
    FROM regras_quebra_exames rqe
    WHERE rqe.exame_quebrado = NEW."ESTUDO_DESCRICAO"
      AND rqe.ativo = true
      AND rqe.categoria_quebrada IS NOT NULL
      AND rqe.categoria_quebrada != ''
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou categoria, definir como "SC"
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    NEW."CATEGORIA" := 'SC';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- =================================================================
-- 2. CREATE ENHANCED SECURITY MONITORING TRIGGERS (CORRECTED)
-- =================================================================

-- Create proper audit triggers for sensitive tables (using INSERT/UPDATE/DELETE only)
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log data access for sensitive operations
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

-- Apply audit triggers to sensitive tables (only for INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS trigger_audit_volumetria_changes ON volumetria_mobilemed;
CREATE TRIGGER trigger_audit_volumetria_changes
  AFTER INSERT OR UPDATE OR DELETE ON volumetria_mobilemed
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

DROP TRIGGER IF EXISTS trigger_audit_clientes_changes ON clientes;
CREATE TRIGGER trigger_audit_clientes_changes
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

DROP TRIGGER IF EXISTS trigger_audit_faturamento_changes ON faturamento;
CREATE TRIGGER trigger_audit_faturamento_changes
  AFTER INSERT OR UPDATE OR DELETE ON faturamento
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_access();

-- =================================================================
-- 3. FINAL SECURITY VALIDATION AND SCORING
-- =================================================================

-- Run final security validation
SELECT validate_security_configuration() as security_status;