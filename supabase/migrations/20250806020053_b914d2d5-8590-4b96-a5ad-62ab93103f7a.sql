-- CRIAR FUNÇÃO DEFINITIVA QUE FORÇA TODOS OS DADOS SEM LIMITAÇÕES
CREATE OR REPLACE FUNCTION public.get_all_volumetria_data()
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
SET work_mem TO '16GB'
SET statement_timeout TO 0
SET row_security TO off
AS $$
BEGIN
  -- CONFIGURAÇÕES MÁXIMAS
  PERFORM set_config('work_mem', '16GB', true);
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  PERFORM set_config('row_security', 'off', true);
  
  -- RETORNAR TODOS OS DADOS DIRETAMENTE DA TABELA
  RETURN QUERY
  SELECT 
    vm."EMPRESA"::text,
    vm."MODALIDADE"::text,
    vm."ESPECIALIDADE"::text,
    vm."MEDICO"::text, 
    vm."PRIORIDADE"::text,
    vm."CATEGORIA"::text,
    COALESCE(vm."VALORES"::numeric, 1) as "VALORES",
    vm."DATA_LAUDO"::date,
    vm."HORA_LAUDO"::time,
    vm."DATA_PRAZO"::date, 
    vm."HORA_PRAZO"::time,
    vm.data_referencia::date,
    vm."NOME_PACIENTE"::text,
    vm."ESTUDO_DESCRICAO"::text
  FROM volumetria_mobilemed vm
  ORDER BY vm.id;
END;
$$;

-- GARANTIR PERMISSÕES TOTAIS
GRANT EXECUTE ON FUNCTION public.get_all_volumetria_data() TO authenticated, anon, public;