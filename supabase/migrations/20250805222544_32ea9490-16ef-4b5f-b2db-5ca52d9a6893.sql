-- Corrigir a fórmula do percentual de atraso para usar total_exames em vez de total_registros
CREATE OR REPLACE FUNCTION get_volumetria_dashboard_stats()
RETURNS TABLE (
  total_exames numeric,
  total_registros numeric,
  total_atrasados numeric,
  percentual_atraso numeric,
  total_clientes numeric,
  total_clientes_volumetria numeric,
  total_modalidades numeric,
  total_especialidades numeric,
  total_medicos numeric,
  total_prioridades numeric,
  clientes_unicos text[],
  modalidades_unicas text[],
  especialidades_unicas text[],
  prioridades_unicas text[],
  medicos_unicos text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_exames_calc numeric;
  total_registros_calc numeric;
  total_atrasados_calc numeric;
  percentual_atraso_calc numeric;
BEGIN
  -- Calcular estatísticas agregadas
  SELECT 
    COALESCE(SUM(vm."VALORES"), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::timestamp + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::timestamp + vm."HORA_PRAZO"::time)
    )
  INTO total_exames_calc, total_registros_calc, total_atrasados_calc
  FROM volumetria_mobilemed vm;
  
  -- Calcular percentual de atraso baseado no TOTAL DE EXAMES, não registros
  percentual_atraso_calc := CASE 
    WHEN total_exames_calc > 0 THEN 
      ROUND((total_atrasados_calc * 100.0 / total_exames_calc), 2)
    ELSE 0
  END;
  
  -- Retornar dados agregados com listas únicas
  RETURN QUERY
  SELECT 
    total_exames_calc,
    total_registros_calc,
    total_atrasados_calc,
    percentual_atraso_calc,
    (SELECT COUNT(DISTINCT c.id) FROM clientes c WHERE c.ativo = true)::numeric,
    (SELECT COUNT(DISTINCT vm."EMPRESA") FROM volumetria_mobilemed vm WHERE vm."EMPRESA" IS NOT NULL)::numeric,
    (SELECT COUNT(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL)::numeric,
    (SELECT COUNT(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL)::numeric,
    (SELECT COUNT(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL)::numeric,
    (SELECT COUNT(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL)::numeric,
    (SELECT ARRAY_AGG(DISTINCT vm."EMPRESA") FROM volumetria_mobilemed vm WHERE vm."EMPRESA" IS NOT NULL),
    (SELECT ARRAY_AGG(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL),
    (SELECT ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL),
    (SELECT ARRAY_AGG(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL),
    (SELECT ARRAY_AGG(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL);
END;
$$;