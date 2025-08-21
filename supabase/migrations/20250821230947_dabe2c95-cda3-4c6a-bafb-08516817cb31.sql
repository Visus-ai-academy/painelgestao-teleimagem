-- Corrigir função get_clientes_stats_completos para resolver incompatibilidade de tipos
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
RETURNS TABLE(
  empresa text, 
  total_exames numeric, 
  total_registros numeric, 
  total_atrasados numeric, 
  percentual_atraso numeric, 
  modalidades_unicas text[], 
  especialidades_unicas text[], 
  medicos_unicos text[], 
  valor_medio_exame numeric, 
  periodo_referencia text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA"::text as empresa,
    COALESCE(SUM(vm."VALORES"), 0)::numeric as total_exames,
    COUNT(*)::numeric as total_registros,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)::numeric as total_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 1)), 1)
      ELSE 0
    END::numeric as percentual_atraso,
    ARRAY_AGG(DISTINCT vm."MODALIDADE") FILTER (WHERE vm."MODALIDADE" IS NOT NULL) as modalidades_unicas,
    ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FILTER (WHERE vm."ESPECIALIDADE" IS NOT NULL) as especialidades_unicas,
    ARRAY_AGG(DISTINCT vm."MEDICO") FILTER (WHERE vm."MEDICO" IS NOT NULL) as medicos_unicos,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(vm."VALORES"), 0) / COUNT(*)::numeric, 2)
      ELSE 0
    END::numeric as valor_medio_exame,
    vm.periodo_referencia::text
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')
  GROUP BY vm."EMPRESA", vm.periodo_referencia
  HAVING COUNT(*) > 0
  ORDER BY total_exames DESC;
END;
$function$