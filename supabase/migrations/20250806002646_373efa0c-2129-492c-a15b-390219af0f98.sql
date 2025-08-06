-- FUNÇÃO ESPECÍFICA PARA ESTATÍSTICAS DE CLIENTES (SEM LIMITAÇÃO)
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
RETURNS TABLE(
  empresa text,
  total_registros bigint,
  total_laudos numeric,
  laudos_atrasados numeric,
  percentual_atraso numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- DESABILITAR RLS
  SET LOCAL row_security = off;
  SET LOCAL work_mem = '512MB';
  
  RETURN QUERY
  SELECT 
    vm."EMPRESA" as empresa,
    COUNT(*) as total_registros,
    COALESCE(SUM(vm."VALORES"), 0) as total_laudos,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0) as laudos_atrasados,
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
$function$