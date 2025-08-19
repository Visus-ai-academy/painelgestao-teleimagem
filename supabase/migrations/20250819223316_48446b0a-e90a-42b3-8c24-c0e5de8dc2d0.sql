-- Dropar a função existente primeiro
DROP FUNCTION IF EXISTS public.get_clientes_stats_completos();

-- Criar função RPC get_clientes_stats_completos que está sendo chamada no contexto
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
 RETURNS TABLE(
   empresa text,
   total_registros bigint,
   total_exames numeric,
   total_atrasados numeric,
   percentual_atraso numeric,
   modalidades text[],
   especialidades text[],
   medicos text[],
   arquivo_fonte text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    COUNT(*) as total_registros,
    COALESCE(SUM(vm."VALORES"), 0) as total_exames,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0) as total_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 0)), 1)
      ELSE 0
    END as percentual_atraso,
    ARRAY_AGG(DISTINCT vm."MODALIDADE") FILTER (WHERE vm."MODALIDADE" IS NOT NULL) as modalidades,
    ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FILTER (WHERE vm."ESPECIALIDADE" IS NOT NULL) as especialidades,
    ARRAY_AGG(DISTINCT vm."MEDICO") FILTER (WHERE vm."MEDICO" IS NOT NULL) as medicos,
    STRING_AGG(DISTINCT vm.arquivo_fonte, ', ') as arquivo_fonte
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL
    AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')  -- Excluir onco dos stats gerais
  GROUP BY vm."EMPRESA"
  ORDER BY total_exames DESC;
END;
$function$;