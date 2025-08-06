-- 🚀 MELHORIAS DE ESCALABILIDADE E AUDITORIA - FASE 2

-- 1. AUDITORIA AUTOMÁTICA: Criar triggers para rastrear alterações
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Para DELETE
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name, operation, record_id, old_data, 
      user_id, user_email, severity
    ) VALUES (
      TG_TABLE_NAME::text, 
      'DELETE',
      OLD.id::text,
      row_to_json(OLD)::jsonb,
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
      'info'
    );
    RETURN OLD;
  END IF;
  
  -- Para UPDATE
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name, operation, record_id, old_data, new_data,
      user_id, user_email, severity
    ) VALUES (
      TG_TABLE_NAME::text, 
      'UPDATE',
      NEW.id::text,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
      'info'
    );
    RETURN NEW;
  END IF;
  
  -- Para INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name, operation, record_id, new_data,
      user_id, user_email, severity
    ) VALUES (
      TG_TABLE_NAME::text, 
      'INSERT',
      NEW.id::text,
      row_to_json(NEW)::jsonb,
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
      'info'
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 2. APLICAR AUDITORIA NAS TABELAS CRÍTICAS
DROP TRIGGER IF EXISTS audit_clientes_trigger ON clientes;
CREATE TRIGGER audit_clientes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_medicos_trigger ON medicos;
CREATE TRIGGER audit_medicos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON medicos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_contratos_trigger ON contratos_clientes;
CREATE TRIGGER audit_contratos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contratos_clientes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_escalas_trigger ON escalas_medicas;
CREATE TRIGGER audit_escalas_trigger
  AFTER INSERT OR UPDATE OR DELETE ON escalas_medicas
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 3. FUNÇÃO PARA LIMPEZA AUTOMÁTICA DE LOGS ANTIGOS
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove logs mais antigos que 90 dias
  DELETE FROM audit_logs 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- 4. FUNÇÃO PARA PAGINAÇÃO OTIMIZADA
CREATE OR REPLACE FUNCTION public.get_paginated_data(
  table_name text,
  page_number integer DEFAULT 1,
  page_size integer DEFAULT 50,
  order_by text DEFAULT 'created_at DESC',
  filter_conditions text DEFAULT ''
)
RETURNS TABLE(
  data jsonb,
  total_count bigint,
  page_info jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offset_value integer;
  total_records bigint;
  total_pages integer;
  query_text text;
BEGIN
  -- Validação de parâmetros
  IF page_number < 1 THEN page_number := 1; END IF;
  IF page_size < 1 OR page_size > 1000 THEN page_size := 50; END IF;
  
  offset_value := (page_number - 1) * page_size;
  
  -- Contar total de registros
  query_text := format('SELECT COUNT(*) FROM %I', table_name);
  IF filter_conditions != '' THEN
    query_text := query_text || ' WHERE ' || filter_conditions;
  END IF;
  
  EXECUTE query_text INTO total_records;
  total_pages := CEIL(total_records::numeric / page_size);
  
  -- Buscar dados paginados
  query_text := format(
    'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM %I',
    table_name
  );
  
  IF filter_conditions != '' THEN
    query_text := query_text || ' WHERE ' || filter_conditions;
  END IF;
  
  query_text := query_text || format(
    ' ORDER BY %s LIMIT %s OFFSET %s) t',
    order_by, page_size, offset_value
  );
  
  EXECUTE query_text INTO data;
  
  RETURN QUERY SELECT 
    COALESCE(data, '[]'::jsonb) as data,
    total_records as total_count,
    jsonb_build_object(
      'current_page', page_number,
      'page_size', page_size,
      'total_pages', total_pages,
      'has_next', page_number < total_pages,
      'has_previous', page_number > 1
    ) as page_info;
END;
$$;

-- 5. ÍNDICES ESPECÍFICOS PARA PERFORMANCE DE CONSULTAS FREQUENTES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumetria_empresa_data_performance 
ON volumetria_mobilemed (EMPRESA, data_referencia, VALORES) 
WHERE EMPRESA IS NOT NULL AND VALORES > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumetria_atraso_analysis 
ON volumetria_mobilemed (DATA_LAUDO, HORA_LAUDO, DATA_PRAZO, HORA_PRAZO, VALORES)
WHERE DATA_LAUDO IS NOT NULL AND HORA_LAUDO IS NOT NULL 
AND DATA_PRAZO IS NOT NULL AND HORA_PRAZO IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escalas_medicas_periodo_performance
ON escalas_medicas (medico_id, data, status, mes_referencia, ano_referencia);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_performance
ON audit_logs (table_name, timestamp, user_id) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- 6. MATERIALIZAR VIEW PARA DASHBOARD PERFORMANCE
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_summary;
CREATE MATERIALIZED VIEW mv_dashboard_summary AS
SELECT 
  'clientes_ativos' as metric,
  COUNT(*) as value,
  CURRENT_DATE as updated_at
FROM clientes WHERE ativo = true
UNION ALL
SELECT 
  'medicos_ativos' as metric,
  COUNT(*) as value,
  CURRENT_DATE as updated_at
FROM medicos WHERE ativo = true
UNION ALL
SELECT 
  'escalas_mes_atual' as metric,
  COUNT(*) as value,
  CURRENT_DATE as updated_at
FROM escalas_medicas 
WHERE mes_referencia = EXTRACT(MONTH FROM CURRENT_DATE)
AND ano_referencia = EXTRACT(YEAR FROM CURRENT_DATE)
UNION ALL
SELECT 
  'total_laudos_mes' as metric,
  COALESCE(SUM(VALORES), 0) as value,
  CURRENT_DATE as updated_at
FROM volumetria_mobilemed 
WHERE data_referencia >= DATE_TRUNC('month', CURRENT_DATE);

-- 7. FUNÇÃO PARA REFRESH AUTOMÁTICO DA MATERIALIZED VIEW
CREATE OR REPLACE FUNCTION public.refresh_dashboard_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_dashboard_summary;
END;
$$;