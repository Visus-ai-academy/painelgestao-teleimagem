-- Atualizar função get_volumetria_dashboard_stats para EXCLUIR volumetria_onco_padrao
CREATE OR REPLACE FUNCTION public.get_volumetria_dashboard_stats()
 RETURNS TABLE(total_exames numeric, total_registros numeric, total_atrasados numeric, percentual_atraso numeric, total_clientes numeric, total_clientes_volumetria numeric, total_modalidades numeric, total_especialidades numeric, total_medicos numeric, total_prioridades numeric, clientes_unicos text[], modalidades_unicas text[], especialidades_unicas text[], prioridades_unicas text[], medicos_unicos text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_exames_calc numeric;
  total_registros_calc numeric;
  total_atrasados_calc numeric;
  percentual_atraso_calc numeric;
BEGIN
  -- GARANTIR bypass completo de RLS
  SET LOCAL row_security = off;
  SET LOCAL work_mem = '256MB';
  
  -- Calcular estatísticas: EXCLUINDO volumetria_onco_padrao (usado apenas para repasse médico)
  SELECT 
    COALESCE(SUM(vm."VALORES"), 0),
    COUNT(*),
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)
  INTO total_exames_calc, total_registros_calc, total_atrasados_calc
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao');
  
  -- Calcular percentual de atraso baseado em VALORES (exames), não registros
  percentual_atraso_calc := CASE 
    WHEN total_exames_calc > 0 THEN 
      ROUND((total_atrasados_calc * 100.0 / total_exames_calc), 1)
    ELSE 0
  END;
  
  -- Retornar dados agregados com listas únicas - EXCLUINDO volumetria_onco_padrao
  RETURN QUERY
  SELECT 
    total_exames_calc,
    total_registros_calc,
    total_atrasados_calc,
    percentual_atraso_calc,
    (SELECT COUNT(DISTINCT c.id) FROM clientes c WHERE c.ativo = true)::numeric,
    (SELECT COUNT(DISTINCT vm."EMPRESA") FROM volumetria_mobilemed vm WHERE vm."EMPRESA" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT ARRAY_AGG(DISTINCT vm."EMPRESA") FROM volumetria_mobilemed vm WHERE vm."EMPRESA" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'));
END;
$function$