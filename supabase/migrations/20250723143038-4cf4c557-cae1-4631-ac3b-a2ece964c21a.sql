-- ============= VIEWS MATERIALIZADAS PARA DASHBOARDS =============

-- View materializada para dashboard de volumetria (atualizada de hora em hora)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_volumetria_dashboard AS
SELECT 
    "EMPRESA",
    "MODALIDADE", 
    "ESPECIALIDADE",
    "PRIORIDADE",
    data_referencia,
    DATE_TRUNC('month', data_referencia) as mes_referencia,
    COUNT(*) as total_registros,
    SUM("VALORES") as total_volume,
    COUNT(*) FILTER (WHERE 
        "DATA_LAUDO" IS NOT NULL AND "HORA_LAUDO" IS NOT NULL AND 
        "DATA_PRAZO" IS NOT NULL AND "HORA_PRAZO" IS NOT NULL AND
        ("DATA_LAUDO"::timestamp + "HORA_LAUDO"::time) > ("DATA_PRAZO"::timestamp + "HORA_PRAZO"::time)
    ) as total_atrasados
FROM volumetria_mobilemed 
WHERE "VALORES" > 0
GROUP BY "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "PRIORIDADE", data_referencia, DATE_TRUNC('month', data_referencia);

-- Índices na view materializada
CREATE INDEX IF NOT EXISTS idx_mv_volumetria_empresa ON mv_volumetria_dashboard("EMPRESA");
CREATE INDEX IF NOT EXISTS idx_mv_volumetria_data ON mv_volumetria_dashboard(data_referencia);
CREATE INDEX IF NOT EXISTS idx_mv_volumetria_mes ON mv_volumetria_dashboard(mes_referencia);

-- ============= FUNÇÃO PARA REFRESH AUTOMÁTICO =============

-- Função para refresh da view materializada
CREATE OR REPLACE FUNCTION refresh_volumetria_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_volumetria_dashboard;
END;
$$;