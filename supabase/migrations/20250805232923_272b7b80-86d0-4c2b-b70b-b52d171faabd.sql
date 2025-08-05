-- Criar função RPC para calcular tempo médio de atraso por cliente
CREATE OR REPLACE FUNCTION public.get_tempo_medio_atraso_clientes()
RETURNS TABLE(
  "EMPRESA" text,
  tempo_medio_atraso_minutos numeric,
  total_laudos_atrasados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    AVG(
      EXTRACT(EPOCH FROM 
        (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) - 
        (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      ) / 60
    )::numeric as tempo_medio_atraso_minutos,
    COUNT(*)::bigint as total_laudos_atrasados
  FROM volumetria_mobilemed vm
  WHERE vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
  GROUP BY vm."EMPRESA"
  ORDER BY tempo_medio_atraso_minutos DESC;
END;
$function$;