-- FUNÇÃO OTIMIZADA PARA CARREGAR DADOS COMPLETOS SEM LIMITAÇÕES
CREATE OR REPLACE FUNCTION public.get_volumetria_complete_data_optimized()
RETURNS TABLE(
  "EMPRESA" text, 
  "MODALIDADE" text, 
  "ESPECIALIDADE" text, 
  "MEDICO" text, 
  "PRIORIDADE" text, 
  "CATEGORIA" text, 
  "VALORES" numeric, 
  "DATA_LAUDO" date, 
  "HORA_LAUDO" time without time zone, 
  "DATA_PRAZO" date, 
  "HORA_PRAZO" time without time zone, 
  data_referencia date, 
  "NOME_PACIENTE" text, 
  "ESTUDO_DESCRICAO" text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- DESABILITAR RLS e definir configurações para máxima performance
  SET LOCAL row_security = off;
  SET LOCAL statement_timeout = 0;
  SET LOCAL work_mem = '1GB';
  SET LOCAL effective_cache_size = '8GB';
  
  -- Log para debug
  RAISE NOTICE 'Carregando dados completos via RPC otimizada...';
  
  -- Retornar TODOS os dados sem qualquer limitação ou filtro
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    vm."MODALIDADE", 
    vm."ESPECIALIDADE",
    vm."MEDICO",
    vm."PRIORIDADE",
    vm."CATEGORIA",
    vm."VALORES"::numeric,
    vm."DATA_LAUDO",
    vm."HORA_LAUDO",
    vm."DATA_PRAZO",
    vm."HORA_PRAZO", 
    vm.data_referencia,
    vm."NOME_PACIENTE",
    vm."ESTUDO_DESCRICAO"
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL 
    AND vm."VALORES" IS NOT NULL
    AND vm."VALORES" > 0
  ORDER BY vm."EMPRESA", vm.id;
  
  -- Log final
  RAISE NOTICE 'Dados completos carregados com sucesso!';
END;
$function$

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