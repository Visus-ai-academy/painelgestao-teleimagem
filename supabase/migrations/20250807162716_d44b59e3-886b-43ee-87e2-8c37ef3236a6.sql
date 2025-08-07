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
      THEN vm."VALORES" ELSE 0 END), 0) -- SOMA DOS VALORES DOS ATRASADOS
  INTO total_exames_calc, total_registros_calc, total_atrasados_calc
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'); -- EXCLUIR ONCO
  
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

---

-- Atualizar função get_volumetria_complete_data para EXCLUIR volumetria_onco_padrao
CREATE OR REPLACE FUNCTION public.get_volumetria_complete_data()
 RETURNS TABLE("EMPRESA" text, "MODALIDADE" text, "ESPECIALIDADE" text, "MEDICO" text, "PRIORIDADE" text, "CATEGORIA" text, "VALORES" numeric, "DATA_LAUDO" date, "HORA_LAUDO" time without time zone, "DATA_PRAZO" date, "HORA_PRAZO" time without time zone, data_referencia date, "NOME_PACIENTE" text, "ESTUDO_DESCRICAO" text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET work_mem TO '8GB'
 SET effective_cache_size TO '16GB'
 SET max_parallel_workers_per_gather TO '16'
 SET statement_timeout TO '0'
 SET lock_timeout TO '0'
 SET idle_in_transaction_session_timeout TO '0'
AS $function$
BEGIN
  -- CONFIGURAÇÕES MÁXIMAS FORÇADAS
  PERFORM set_config('work_mem', '8GB', true);
  PERFORM set_config('effective_cache_size', '16GB', true);
  PERFORM set_config('max_parallel_workers_per_gather', '16', true);
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  PERFORM set_config('idle_in_transaction_session_timeout', '0', true);
  
  -- DESABILITAR RLS COMPLETAMENTE
  SET LOCAL row_security = off;
  
  -- RETORNAR TODOS OS DADOS EXCLUINDO volumetria_onco_padrao (repasse médico)
  RETURN QUERY
  SELECT 
    vm."EMPRESA"::text,
    vm."MODALIDADE"::text,
    vm."ESPECIALIDADE"::text,
    vm."MEDICO"::text,
    vm."PRIORIDADE"::text,
    vm."CATEGORIA"::text,
    vm."VALORES"::numeric,
    vm."DATA_LAUDO",
    vm."HORA_LAUDO",
    vm."DATA_PRAZO",
    vm."HORA_PRAZO",
    vm.data_referencia,
    vm."NOME_PACIENTE"::text,
    vm."ESTUDO_DESCRICAO"::text
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao') -- EXCLUIR ONCO
  ORDER BY vm.data_referencia DESC, vm."DATA_LAUDO" DESC;
END;
$function$

---

-- Atualizar função get_volumetria_aggregated_stats para EXCLUIR volumetria_onco_padrao
CREATE OR REPLACE FUNCTION public.get_volumetria_aggregated_stats()
 RETURNS TABLE(arquivo_fonte text, total_records numeric, records_with_value numeric, records_zeroed numeric, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm.arquivo_fonte,
    COUNT(*)::numeric as total_records,
    COUNT(*) FILTER (WHERE vm."VALORES" > 0)::numeric as records_with_value,
    COUNT(*) FILTER (WHERE vm."VALORES" = 0 OR vm."VALORES" IS NULL)::numeric as records_zeroed,
    COALESCE(SUM(vm."VALORES"), 0)::numeric as total_value
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN (
    'volumetria_padrao', 
    'volumetria_fora_padrao', 
    'volumetria_padrao_retroativo', 
    'volumetria_fora_padrao_retroativo',
    'data_laudo',
    'data_exame'
    -- REMOVIDO: 'volumetria_onco_padrao' (usado apenas para repasse médico)
  )
  GROUP BY vm.arquivo_fonte;
END;
$function$

---

-- Atualizar função get_laudos_atrasados_completos para EXCLUIR volumetria_onco_padrao
CREATE OR REPLACE FUNCTION public.get_laudos_atrasados_completos()
 RETURNS TABLE("EMPRESA" text, "NOME_PACIENTE" text, "ESTUDO_DESCRICAO" text, "MODALIDADE" text, "ESPECIALIDADE" text, "CATEGORIA" text, "PRIORIDADE" text, "MEDICO" text, "VALORES" numeric, "DATA_LAUDO" date, "HORA_LAUDO" time without time zone, "DATA_PRAZO" date, "HORA_PRAZO" time without time zone, data_referencia date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- GARANTIR bypass completo de RLS e RETORNAR TODOS os dados
  SET LOCAL row_security = off;
  SET LOCAL statement_timeout = 0;
  SET LOCAL work_mem = '256MB';
  
  -- Retornar TODOS os laudos atrasados EXCLUINDO volumetria_onco_padrao
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    vm."NOME_PACIENTE",
    vm."ESTUDO_DESCRICAO", 
    vm."MODALIDADE",
    vm."ESPECIALIDADE",
    vm."CATEGORIA",
    vm."PRIORIDADE", 
    vm."MEDICO",
    vm."VALORES"::numeric,
    vm."DATA_LAUDO",
    vm."HORA_LAUDO",
    vm."DATA_PRAZO", 
    vm."HORA_PRAZO",
    vm.data_referencia
  FROM volumetria_mobilemed vm
  WHERE vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL
    AND vm."DATA_PRAZO" IS NOT NULL
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
    AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao') -- EXCLUIR ONCO
  ORDER BY vm."DATA_LAUDO" DESC, vm."HORA_LAUDO" DESC;
END;
$function$

---

-- Atualizar função get_tempo_medio_atraso_clientes para EXCLUIR volumetria_onco_padrao
CREATE OR REPLACE FUNCTION public.get_tempo_medio_atraso_clientes()
 RETURNS TABLE(empresa text, tempo_medio_atraso_horas numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- FORÇAR bypass completo de RLS
  SET LOCAL row_security = off;
  
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    AVG(
      EXTRACT(EPOCH FROM (
        (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) - 
        (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      )) / 3600
    )::numeric as tempo_medio_atraso_horas
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL
    AND vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
    AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao') -- EXCLUIR ONCO
  GROUP BY vm."EMPRESA"
  HAVING COUNT(*) > 0; -- APENAS clientes que TÊM laudos atrasados
END;
$function$