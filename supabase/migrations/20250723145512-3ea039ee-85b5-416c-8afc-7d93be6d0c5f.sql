-- ============= IMPLEMENTAÇÃO DE PARTICIONAMENTO E MÉTRICAS CUSTOMIZADAS =============

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

-- Tabela para análise de particionamento
CREATE TABLE IF NOT EXISTS partition_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_count BIGINT,
    size_mb NUMERIC,
    recommendation TEXT,
    partition_strategy TEXT,
    expected_performance_gain TEXT,
    analysis_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Índices para performance das métricas
CREATE INDEX IF NOT EXISTS idx_custom_metric_values_metric_timestamp 
ON custom_metric_values(metric_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_custom_metric_values_dimensions 
ON custom_metric_values USING GIN(dimensions);

CREATE INDEX IF NOT EXISTS idx_partition_analysis_table_timestamp
ON partition_analysis(table_name, analysis_timestamp DESC);

-- RLS para métricas customizadas
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metric_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE partition_analysis ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Admins podem gerenciar análise de partições"
    ON partition_analysis FOR ALL
    USING (is_admin());

CREATE POLICY "Managers podem ver análise de partições"
    ON partition_analysis FOR SELECT
    USING (is_manager_or_admin());

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
    result_record RECORD;
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
    
    -- Executar query e capturar resultado
    BEGIN
        EXECUTE final_query INTO result_record;
        query_result := row_to_json(result_record);
    EXCEPTION
        WHEN OTHERS THEN
            query_result := jsonb_build_object('error', SQLERRM, 'sql_state', SQLSTATE);
    END;
    
    RETURN query_result;
END;
$$;

-- Função para análise de volume e recomendação de particionamento
CREATE OR REPLACE FUNCTION analyze_partitioning_need()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    volumetria_count BIGINT := 0;
    volumetria_size_mb NUMERIC := 0;
    recommendation TEXT;
    analysis JSONB;
    analysis_id UUID;
BEGIN
    -- Verificar se a tabela volumetria_mobilemed existe
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'volumetria_mobilemed') THEN
        
        -- Contar registros
        SELECT COUNT(*) INTO volumetria_count FROM volumetria_mobilemed;
        
        -- Estimar tamanho (aproximado)
        SELECT ROUND(pg_total_relation_size('public.volumetria_mobilemed'::regclass) / (1024.0 * 1024.0), 2) 
        INTO volumetria_size_mb;
        
        -- Determinar recomendação
        IF volumetria_count > 10000000 OR volumetria_size_mb > 1000 THEN
            recommendation := 'URGENT: Implementar particionamento imediatamente';
        ELSIF volumetria_count > 5000000 OR volumetria_size_mb > 500 THEN
            recommendation := 'RECOMMENDED: Planejar particionamento';
        ELSIF volumetria_count > 1000000 OR volumetria_size_mb > 100 THEN
            recommendation := 'MONITOR: Considerar particionamento em breve';
        ELSE
            recommendation := 'OK: Particionamento não necessário no momento';
        END IF;
    ELSE
        volumetria_count := 0;
        volumetria_size_mb := 0;
        recommendation := 'TABLE_NOT_EXISTS: Será criada com particionamento quando necessário';
    END IF;
    
    -- Salvar análise na tabela específica
    INSERT INTO partition_analysis (
        table_name, record_count, size_mb, recommendation, 
        partition_strategy, expected_performance_gain, metadata
    ) VALUES (
        'volumetria_mobilemed', 
        volumetria_count, 
        volumetria_size_mb, 
        recommendation,
        'monthly_by_data_referencia',
        CASE 
            WHEN volumetria_count > 5000000 THEN '60-80%'
            WHEN volumetria_count > 1000000 THEN '30-50%'
            ELSE '10-20%'
        END,
        jsonb_build_object('table_exists', volumetria_count > 0)
    ) RETURNING id INTO analysis_id;
    
    -- Montar resultado
    analysis := jsonb_build_object(
        'analysis_id', analysis_id,
        'table_name', 'volumetria_mobilemed',
        'record_count', volumetria_count,
        'size_mb', volumetria_size_mb,
        'recommendation', recommendation,
        'partition_strategy', 'monthly_by_data_referencia',
        'expected_performance_gain', CASE 
            WHEN volumetria_count > 5000000 THEN '60-80%'
            WHEN volumetria_count > 1000000 THEN '30-50%'
            ELSE '10-20%'
        END,
        'analysis_timestamp', NOW()
    );
    
    RETURN analysis;
END;
$$;

-- Função para manutenção de métricas
CREATE OR REPLACE FUNCTION update_custom_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    metric_record RECORD;
    metric_result JSONB;
    updated_count INTEGER := 0;
BEGIN
    -- Iterar sobre métricas ativas
    FOR metric_record IN 
        SELECT * FROM custom_metrics 
        WHERE enabled = true
    LOOP
        -- Calcular métrica
        metric_result := calculate_custom_metric(metric_record.name);
        
        -- Se não houve erro, salvar valor
        IF NOT (metric_result ? 'error') THEN
            INSERT INTO custom_metric_values (metric_id, value, dimensions, metadata)
            VALUES (
                metric_record.id,
                COALESCE((metric_result->>'value')::NUMERIC, 0),
                COALESCE(metric_result->'dimensions', '{}'),
                jsonb_build_object('calculated_at', NOW(), 'metric_type', metric_record.metric_type)
            );
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Função para criar partições futuras (preparação)
CREATE OR REPLACE FUNCTION prepare_partition_structure(table_name TEXT, partition_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    result JSONB;
BEGIN
    -- Nome da partição baseado no mês
    partition_name := table_name || '_' || to_char(partition_date, 'YYYY_MM');
    
    -- Datas de início e fim da partição (mensal)
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    -- Retornar estrutura preparada
    result := jsonb_build_object(
        'partition_name', partition_name,
        'table_name', table_name,
        'start_date', start_date,
        'end_date', end_date,
        'sql_create', format(
            'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, table_name, start_date, end_date
        ),
        'status', 'prepared'
    );
    
    RETURN result;
END;
$$;

-- Inserir métricas padrão do sistema
INSERT INTO custom_metrics (name, description, query_template, metric_type, parameters) VALUES
('volumetria_total_exames', 
 'Total de exames processados por período',
 'SELECT COALESCE(SUM("VALORES"), 0) as value FROM volumetria_mobilemed WHERE data_referencia >= CURRENT_DATE - INTERVAL ''30 days''',
 'gauge',
 '{"period": "30_days"}'
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
),
('uploads_status_summary',
 'Resumo de status dos uploads',
 'SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = ''completed'') as completed,
    COUNT(*) FILTER (WHERE status = ''error'') as errors,
    COUNT(*) FILTER (WHERE status = ''processing'') as processing
  FROM upload_logs WHERE created_at >= NOW() - INTERVAL ''24 hours''',
 'gauge',
 '{"period": "24_hours"}'
)
ON CONFLICT (name) DO NOTHING;

-- Agendar atualização de métricas a cada hora
SELECT cron.schedule(
    'update-custom-metrics',
    '0 * * * *', -- A cada hora
    $$
    SELECT update_custom_metrics();
    $$
);

-- Agendar análise de particionamento semanal
SELECT cron.schedule(
    'analyze-partitioning-need',
    '0 6 * * 1', -- Toda segunda-feira às 6h
    $$
    SELECT analyze_partitioning_need();
    $$
);