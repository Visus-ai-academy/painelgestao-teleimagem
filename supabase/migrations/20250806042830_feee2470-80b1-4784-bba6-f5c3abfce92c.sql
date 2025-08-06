-- 🔐 CORREÇÃO SEARCH_PATH - LOTE 2 (Funções críticas de volumetria e performance)

CREATE OR REPLACE FUNCTION public.get_volumetria_stats(p_empresa text DEFAULT NULL, p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL)
RETURNS TABLE(total_exames bigint, total_registros bigint, total_atrasados bigint, percentual_atraso numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
RETURNS TABLE(empresa text, total_registros bigint, total_laudos bigint, laudos_atrasados bigint, percentual_atraso numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DESABILITAR RLS
  SET LOCAL row_security = off;
  SET LOCAL work_mem = '512MB';
  
  RETURN QUERY
  SELECT 
    vm."EMPRESA" as empresa,
    COUNT(*) as total_registros,
    COALESCE(SUM(vm."VALORES"), 0)::bigint as total_laudos,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)::bigint as laudos_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 0)), 2)
      ELSE 0
    END as percentual_atraso
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL 
    AND vm."VALORES" IS NOT NULL
    AND vm."VALORES" > 0
  GROUP BY vm."EMPRESA"
  ORDER BY total_laudos DESC;
END;
$$;