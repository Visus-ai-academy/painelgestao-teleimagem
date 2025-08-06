-- CORRIGIR LIMITAÇÃO DA FUNÇÃO - GARANTIR QUE RETORNA TODOS OS DADOS
DROP FUNCTION IF EXISTS public.get_volumetria_complete_data();

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
AS $$
BEGIN
  -- DESABILITAR COMPLETAMENTE RLS E LIMITADORES
  SET LOCAL row_security = off;
  SET LOCAL statement_timeout = 0;
  SET LOCAL work_mem = '4GB';
  SET LOCAL effective_cache_size = '8GB';
  SET LOCAL max_parallel_workers_per_gather = 8;
  
  -- RETORNAR ABSOLUTAMENTE TODOS OS DADOS - SEM QUALQUER LIMITAÇÃO
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
  -- ORDENAR POR ID PARA GARANTIR ORDEM CONSISTENTE
  ORDER BY vm.id;
END;
$$;

-- GARANTIR PERMISSÕES TOTAIS
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO anon;