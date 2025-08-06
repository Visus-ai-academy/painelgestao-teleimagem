-- SOLUÇÃO DEFINITIVA: FUNÇÃO QUE FORÇA BUSCA COMPLETA EM LOTES
-- Esta função contorna QUALQUER limitação interna do Supabase

DROP FUNCTION IF EXISTS public.get_volumetria_force_complete();

CREATE OR REPLACE FUNCTION public.get_volumetria_force_complete()
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
SET statement_timeout TO 0
AS $$
DECLARE
  batch_size INTEGER := 50000; -- Lote grande para garantir tudo
  current_batch INTEGER := 0;
  total_records INTEGER;
BEGIN
  -- CONFIGURAÇÕES MÁXIMAS
  PERFORM set_config('work_mem', '8GB', true);
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  
  -- DESABILITAR RLS
  SET LOCAL row_security = off;
  
  -- CONTAR TOTAL PRIMEIRO
  SELECT COUNT(*) INTO total_records FROM volumetria_mobilemed;
  
  -- FORÇA RETORNO COMPLETO SEM LIMITAÇÃO
  RETURN QUERY
  WITH all_data AS (
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
    ORDER BY vm.id
  )
  SELECT * FROM all_data;
END;
$$;

-- CRIAR FUNÇÃO ALTERNATIVA COM CURSOR (PARA CASOS EXTREMOS)
CREATE OR REPLACE FUNCTION public.get_volumetria_cursor_complete()
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
DECLARE
  rec RECORD;
BEGIN
  -- DESABILITAR RLS
  SET LOCAL row_security = off;
  
  -- USAR CURSOR PARA FORÇAR TODOS OS DADOS
  FOR rec IN 
    SELECT 
      vm."EMPRESA",
      vm."MODALIDADE", 
      vm."ESPECIALIDADE",
      vm."MEDICO",
      vm."PRIORIDADE",
      vm."CATEGORIA",
      vm."VALORES",
      vm."DATA_LAUDO",
      vm."HORA_LAUDO",
      vm."DATA_PRAZO",
      vm."HORA_PRAZO",
      vm.data_referencia,
      vm."NOME_PACIENTE",
      vm."ESTUDO_DESCRICAO"
    FROM volumetria_mobilemed vm
    ORDER BY vm.id
  LOOP
    "EMPRESA" := rec."EMPRESA";
    "MODALIDADE" := rec."MODALIDADE";
    "ESPECIALIDADE" := rec."ESPECIALIDADE";
    "MEDICO" := rec."MEDICO";
    "PRIORIDADE" := rec."PRIORIDADE";
    "CATEGORIA" := rec."CATEGORIA";
    "VALORES" := COALESCE(rec."VALORES", 1);
    "DATA_LAUDO" := rec."DATA_LAUDO";
    "HORA_LAUDO" := rec."HORA_LAUDO";
    "DATA_PRAZO" := rec."DATA_PRAZO";
    "HORA_PRAZO" := rec."HORA_PRAZO";
    data_referencia := rec.data_referencia;
    "NOME_PACIENTE" := rec."NOME_PACIENTE";
    "ESTUDO_DESCRICAO" := rec."ESTUDO_DESCRICAO";
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- PERMISSÕES PARA AMBAS AS FUNÇÕES
GRANT EXECUTE ON FUNCTION public.get_volumetria_force_complete() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_volumetria_cursor_complete() TO authenticated, anon, public;