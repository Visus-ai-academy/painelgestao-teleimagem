-- REMOVER FUNÇÕES EXISTENTES E RECRIAR SEM LIMITAÇÕES

-- 1. LIMPAR FUNÇÕES EXISTENTES
DROP FUNCTION IF EXISTS public.get_volumetria_complete_data();
DROP FUNCTION IF EXISTS public.get_volumetria_unlimited();
DROP FUNCTION IF EXISTS public.get_volumetria_total_count();

-- 2. RECRIAR FUNÇÃO PRINCIPAL SEM LIMITAÇÕES
CREATE OR REPLACE FUNCTION public.get_volumetria_complete_data()
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
SET work_mem TO '8GB'
SET effective_cache_size TO '16GB'
SET statement_timeout TO 0
AS $$
BEGIN
  -- FORÇAR CONFIGURAÇÕES MÁXIMAS
  PERFORM set_config('work_mem', '8GB', true);
  PERFORM set_config('effective_cache_size', '16GB', true);
  PERFORM set_config('statement_timeout', '0', true);
  
  -- DESABILITAR RLS COMPLETAMENTE
  SET LOCAL row_security = off;
  
  -- RETORNAR TODOS OS DADOS
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

-- 3. FUNÇÃO PARA CONTAGEM TOTAL
CREATE OR REPLACE FUNCTION public.get_volumetria_total_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*) FROM volumetria_mobilemed;
$$;

-- 4. GARANTIR PERMISSÕES TOTAIS
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_volumetria_total_count() TO authenticated, anon, public;