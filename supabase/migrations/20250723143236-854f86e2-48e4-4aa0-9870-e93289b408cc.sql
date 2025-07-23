-- ============= OTIMIZAÇÕES ESTRUTURAIS =============

-- Constraints para integridade de dados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clientes_status') THEN
        ALTER TABLE clientes ADD CONSTRAINT chk_clientes_status CHECK (status IN ('Ativo', 'Inativo', 'Suspenso'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_faturamento_valor_positivo') THEN
        ALTER TABLE faturamento ADD CONSTRAINT chk_faturamento_valor_positivo CHECK (valor > 0);
    END IF;
END $$;

-- ============= FUNÇÕES OTIMIZADAS PARA DASHBOARD =============

-- Função otimizada para estatísticas de volumetria
CREATE OR REPLACE FUNCTION get_volumetria_stats(
    p_empresa TEXT DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE(
    total_exames BIGINT,
    total_registros BIGINT,
    total_atrasados BIGINT,
    percentual_atraso NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(v."VALORES"), 0)::BIGINT as total_exames,
        COUNT(*)::BIGINT as total_registros,
        COUNT(*) FILTER (WHERE 
            v."DATA_LAUDO" IS NOT NULL AND v."HORA_LAUDO" IS NOT NULL AND 
            v."DATA_PRAZO" IS NOT NULL AND v."HORA_PRAZO" IS NOT NULL AND
            (v."DATA_LAUDO"::timestamp + v."HORA_LAUDO"::time) > (v."DATA_PRAZO"::timestamp + v."HORA_PRAZO"::time)
        )::BIGINT as total_atrasados,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE 
                    v."DATA_LAUDO" IS NOT NULL AND v."HORA_LAUDO" IS NOT NULL AND 
                    v."DATA_PRAZO" IS NOT NULL AND v."HORA_PRAZO" IS NOT NULL AND
                    (v."DATA_LAUDO"::timestamp + v."HORA_LAUDO"::time) > (v."DATA_PRAZO"::timestamp + v."HORA_PRAZO"::time)
                ) * 100.0 / COUNT(*)), 2)
            ELSE 0
        END as percentual_atraso
    FROM volumetria_mobilemed v
    WHERE (p_empresa IS NULL OR v."EMPRESA" = p_empresa)
      AND (p_data_inicio IS NULL OR v.data_referencia >= p_data_inicio)
      AND (p_data_fim IS NULL OR v.data_referencia <= p_data_fim)
      AND v."VALORES" > 0;
END;
$$;