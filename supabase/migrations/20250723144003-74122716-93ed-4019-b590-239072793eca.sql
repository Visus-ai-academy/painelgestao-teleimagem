-- ============= CRONJOB PARA REFRESH AUTOMÁTICO =============

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar refresh da view materializada a cada hora
SELECT cron.schedule(
  'refresh-volumetria-dashboard',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT refresh_volumetria_dashboard();
  $$
);

-- ============= ARQUIVAMENTO DE DADOS ANTIGOS =============

-- Tabela para dados arquivados (>2 anos)
CREATE TABLE IF NOT EXISTS volumetria_mobilemed_archive (
    LIKE volumetria_mobilemed INCLUDING ALL
);

-- Função para arquivar dados antigos
CREATE OR REPLACE FUNCTION archive_old_volumetria_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Agendar arquivamento mensal (dia 1 às 2h da manhã)
SELECT cron.schedule(
  'archive-old-volumetria',
  '0 2 1 * *', -- Todo dia 1 do mês às 2h
  $$
  SELECT archive_old_volumetria_data();
  $$
);

-- ============= OTIMIZAÇÃO DE RLS POLICIES =============

-- Função otimizada para verificar permissões de usuário
CREATE OR REPLACE FUNCTION user_can_access_empresa(empresa_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- (implementar lógica específica se necessário)
    RETURN TRUE; -- Por enquanto, todos podem ver
END;
$$;