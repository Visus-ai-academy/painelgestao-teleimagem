-- ============= IMPLEMENTAÇÃO DE PARTICIONAMENTO =============

-- Função para criar partições automaticamente
CREATE OR REPLACE FUNCTION create_volumetria_partition(partition_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Nome da partição baseado no mês
    partition_name := 'volumetria_mobilemed_' || to_char(partition_date, 'YYYY_MM');
    
    -- Datas de início e fim da partição (mensal)
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    -- Criar partição se não existir
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF volumetria_mobilemed
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    -- Criar índices específicos da partição
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("EMPRESA", data_referencia)', 
                  partition_name || '_empresa_data_idx', partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("ESPECIALIDADE", data_referencia)', 
                  partition_name || '_especialidade_data_idx', partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("MODALIDADE", data_referencia)', 
                  partition_name || '_modalidade_data_idx', partition_name);
    
    -- Log da criação
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'CREATE_PARTITION', partition_name, 
            jsonb_build_object('partition_name', partition_name, 'start_date', start_date, 'end_date', end_date),
            'system', 'info');
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro
        INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
        VALUES ('volumetria_mobilemed', 'CREATE_PARTITION_ERROR', partition_name,
                jsonb_build_object('error', SQLERRM), 'system', 'error');
        RETURN FALSE;
END;
$$;

-- Converter tabela existente para particionada (se ainda não for)
-- ATENÇÃO: Esta operação pode ser demorada para tabelas grandes
DO $$
DECLARE
    is_partitioned BOOLEAN;
BEGIN
    -- Verificar se já é particionada
    SELECT EXISTS (
        SELECT 1 FROM pg_partitioned_table 
        WHERE schemaname = 'public' AND tablename = 'volumetria_mobilemed'
    ) INTO is_partitioned;
    
    IF NOT is_partitioned THEN
        -- Backup da tabela original
        EXECUTE 'CREATE TABLE volumetria_mobilemed_backup AS SELECT * FROM volumetria_mobilemed LIMIT 0';
        
        -- Recrear como particionada (apenas para novas implementações)
        RAISE NOTICE 'Tabela volumetria_mobilemed será convertida para particionamento por data_referencia';
        
        -- Por segurança, apenas logamos a intenção. A conversão deve ser feita manualmente em produção
        INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
        VALUES ('volumetria_mobilemed', 'PARTITION_CONVERSION_PLANNED', 'main_table',
                jsonb_build_object('status', 'planned', 'action_required', 'manual_conversion'),
                'system', 'warning');
    END IF;
END;
$$;

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    month_date DATE;
BEGIN
    -- Criar partições do mês atual até 12 meses no futuro
    FOR i IN 0..12 LOOP
        month_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        PERFORM create_volumetria_partition(month_date);
    END LOOP;
END;
$$;

-- ============= MÉTRICAS CUSTOMIZADAS =============

-- Tabela para definir métricas customizadas
CREATE TABLE IF NOT EXISTS custom_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    query_template TEXT NOT NULL, -- Template SQL com placeholders
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    update_frequency_minutes INTEGER DEFAULT 60,
    enabled BOOLEAN DEFAULT true,
    parameters JSONB DEFAULT '{}', -- Parâmetros para a query
    alert_thresholds JSONB DEFAULT '{}', -- Limites para alertas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Tabela para armazenar valores das métricas
CREATE TABLE IF NOT EXISTS custom_metric_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_id UUID REFERENCES custom_metrics(id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}', -- Dimensões da métrica (empresa, modalidade, etc)
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Índices para performance das métricas
CREATE INDEX IF NOT EXISTS idx_custom_metric_values_metric_timestamp 
ON custom_metric_values(metric_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_custom_metric_values_dimensions 
ON custom_metric_values USING GIN(dimensions);

-- RLS para métricas customizadas
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metric_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar métricas customizadas"
    ON custom_metrics FOR ALL
    USING (is_admin());

CREATE POLICY "Managers podem ver métricas customizadas"
    ON custom_metrics FOR SELECT
    USING (is_manager_or_admin());

CREATE POLICY "Admins podem gerenciar valores de métricas"
    ON custom_metric_values FOR ALL
    USING (is_admin());

CREATE POLICY "Usuários podem ver valores de métricas"
    ON custom_metric_values FOR SELECT
    USING (true);

-- Função para calcular métrica customizada
CREATE OR REPLACE FUNCTION calculate_custom_metric(metric_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    metric_config RECORD;
    query_result JSONB;
    final_query TEXT;
BEGIN
    -- Buscar configuração da métrica
    SELECT * INTO metric_config 
    FROM custom_metrics 
    WHERE name = metric_name AND enabled = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Métrica não encontrada ou desabilitada');
    END IF;
    
    -- Substituir placeholders na query
    final_query := metric_config.query_template;
    final_query := REPLACE(final_query, '{{current_date}}', CURRENT_DATE::TEXT);
    final_query := REPLACE(final_query, '{{last_month}}', (CURRENT_DATE - INTERVAL '1 month')::TEXT);
    
    -- Executar query e retornar resultado
    EXECUTE 'SELECT row_to_json(result) FROM (' || final_query || ') AS result' INTO query_result;
    
    RETURN query_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Inserir métricas padrão do sistema
INSERT INTO custom_metrics (name, description, query_template, metric_type, parameters) VALUES
('volumetria_total_exames', 
 'Total de exames processados por período',
 'SELECT COALESCE(SUM("VALORES"), 0) as value FROM volumetria_mobilemed WHERE data_referencia >= ''{{current_date}}''::date - INTERVAL ''30 days''',
 'gauge',
 '{"period": "30_days"}'
),
('volumetria_atraso_percentual',
 'Percentual de exames com atraso no laudo',
 'SELECT ROUND(
    (COUNT(*) FILTER (WHERE 
        "DATA_LAUDO" IS NOT NULL AND "HORA_LAUDO" IS NOT NULL AND 
        "DATA_PRAZO" IS NOT NULL AND "HORA_PRAZO" IS NOT NULL AND
        ("DATA_LAUDO"::timestamp + "HORA_LAUDO"::time) > ("DATA_PRAZO"::timestamp + "HORA_PRAZO"::time)
    ) * 100.0 / NULLIF(COUNT(*), 0)), 2
 ) as value
 FROM volumetria_mobilemed 
 WHERE data_referencia >= CURRENT_DATE - INTERVAL ''7 days''',
 'gauge',
 '{"period": "7_days"}'
),
('clientes_ativos_total',
 'Total de clientes ativos no sistema',
 'SELECT COUNT(*) as value FROM clientes WHERE status = ''Ativo''',
 'gauge',
 '{}'
),
('performance_query_avg',
 'Tempo médio de queries em ms (últimas 24h)',
 'SELECT COALESCE(AVG(query_time), 0) as value FROM performance_logs WHERE timestamp >= NOW() - INTERVAL ''24 hours''',
 'gauge',
 '{"period": "24_hours"}'
)
ON CONFLICT (name) DO NOTHING;

-- ============= AUTOMATIZAÇÃO DE PARTIÇÕES =============

-- Função para manutenção automática de partições
CREATE OR REPLACE FUNCTION maintain_volumetria_partitions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    created_count INTEGER := 0;
    deleted_count INTEGER := 0;
    future_month DATE;
    old_partition TEXT;
BEGIN
    -- Criar partições para os próximos 3 meses se não existirem
    FOR i IN 1..3 LOOP
        future_month := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        IF create_volumetria_partition(future_month) THEN
            created_count := created_count + 1;
        END IF;
    END LOOP;
    
    -- Remover partições muito antigas (> 3 anos) se configurado
    -- (Comentado por segurança - ativar apenas se necessário)
    /*
    FOR old_partition IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'volumetria_mobilemed_%' 
        AND tablename < 'volumetria_mobilemed_' || to_char(CURRENT_DATE - INTERVAL '3 years', 'YYYY_MM')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || old_partition;
        deleted_count := deleted_count + 1;
    END LOOP;
    */
    
    -- Log da manutenção
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'PARTITION_MAINTENANCE', 'auto',
            jsonb_build_object('created_partitions', created_count, 'deleted_partitions', deleted_count),
            'system', 'info');
    
    RETURN created_count;
END;
$$;

-- Agendar manutenção de partições (toda primeira segunda-feira do mês às 2h)
SELECT cron.schedule(
    'maintain-volumetria-partitions',
    '0 2 1-7 * 1', -- Primeira segunda-feira do mês às 2h
    $$
    SELECT maintain_volumetria_partitions();
    $$
);

-- ============= TRIGGER PARA MÉTRICAS EM TEMPO REAL =============

-- Trigger para atualizar métricas automaticamente
CREATE OR REPLACE FUNCTION trigger_metric_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Notificar sistema de métricas sobre mudança (async)
    PERFORM net.http_post(
        url := 'https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/performance-monitor',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'action', 'update_metrics',
            'table', TG_TABLE_NAME,
            'operation', TG_OP
        )
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Aplicar trigger nas tabelas principais (se necessário)
-- CREATE TRIGGER volumetria_metric_trigger 
--     AFTER INSERT OR UPDATE OR DELETE ON volumetria_mobilemed
--     FOR EACH ROW EXECUTE FUNCTION trigger_metric_update();