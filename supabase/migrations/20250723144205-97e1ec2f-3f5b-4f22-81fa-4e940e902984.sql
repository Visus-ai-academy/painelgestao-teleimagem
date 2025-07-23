-- ============= TABELA PARA LOGS DE PERFORMANCE =============

-- Tabela para métricas de performance
CREATE TABLE IF NOT EXISTS performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_time INTEGER NOT NULL, -- tempo em ms
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    row_count INTEGER,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Índices para performance dos logs
CREATE INDEX IF NOT EXISTS idx_performance_logs_timestamp ON performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_logs_table ON performance_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_performance_logs_slow ON performance_logs(query_time) WHERE query_time > 5000;

-- RLS para logs de performance
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de performance"
    ON performance_logs FOR SELECT
    USING (is_admin());

CREATE POLICY "Sistema pode inserir logs"
    ON performance_logs FOR INSERT
    WITH CHECK (true);

-- ============= OTIMIZAÇÃO DE RLS POLICIES EXISTENTES =============

-- Otimizar política de volumetria (mais específica e rápida)
DROP POLICY IF EXISTS "Proteção temporal - SELECT volumetria_mobilemed" ON volumetria_mobilemed;

CREATE POLICY "Acesso otimizado volumetria"
    ON volumetria_mobilemed FOR SELECT
    USING (
        can_view_data(data_referencia) AND 
        user_can_access_empresa("EMPRESA")
    );

-- ============= AUTOMATIZAÇÃO DE LIMPEZA =============

-- Função para limpar logs antigos de performance (manter só 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_performance_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Agendar limpeza diária às 3h da manhã
SELECT cron.schedule(
  'cleanup-performance-logs',
  '0 3 * * *', -- Todo dia às 3h
  $$
  SELECT cleanup_old_performance_logs();
  $$
);

-- ============= MONITORAMENTO AUTOMÁTICO =============

-- Agendar verificação de saúde do sistema a cada 15 minutos
SELECT cron.schedule(
  'system-health-check',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT net.http_post(
    url := 'https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/performance-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key', true) || '"}'::jsonb,
    body := '{"action": "check_system_health"}'::jsonb
  );
  $$
);