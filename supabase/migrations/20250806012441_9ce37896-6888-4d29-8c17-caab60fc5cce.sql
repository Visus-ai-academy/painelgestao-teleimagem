-- CORRIGIR FUNÇÃO PARA REMOVER QUALQUER LIMITAÇÃO DE REGISTROS
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
  -- CONFIGURAÇÕES PARA GARANTIR TODOS OS DADOS
  SET LOCAL row_security = off;
  SET LOCAL statement_timeout = 0;
  SET LOCAL work_mem = '1GB';
  SET LOCAL max_parallel_workers_per_gather = 4;
  
  -- RETORNAR ABSOLUTAMENTE TODOS OS DADOS SEM QUALQUER LIMITE
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
  WHERE vm."VALORES" IS NOT NULL -- APENAS REGISTROS COM VALORES VÁLIDOS
  ORDER BY vm.id;
END;
$$;

-- Garantir permissões corretas
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO authenticated;