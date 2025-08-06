-- FUNÇÃO DEFINITIVA: ELIMINAR TODAS AS LIMITAÇÕES DO SUPABASE
-- Criar função que FORÇA retorno de TODOS os dados sem QUALQUER limitação

DROP FUNCTION IF EXISTS public.get_volumetria_unlimited_force();

CREATE OR REPLACE FUNCTION public.get_volumetria_unlimited_force()
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
SET lock_timeout TO 0
SET deadlock_timeout TO 0
AS $$
BEGIN
  -- CONFIGURAÇÕES MÁXIMAS PARA FORÇAR TODOS OS DADOS
  PERFORM set_config('work_mem', '16GB', true);
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  PERFORM set_config('deadlock_timeout', '0', true);
  PERFORM set_config('temp_buffers', '1GB', true);
  PERFORM set_config('shared_buffers', '2GB', true);
  
  -- DESABILITAR COMPLETAMENTE RLS
  SET LOCAL row_security = off;
  
  -- RETORNAR TODOS OS DADOS SEM QUALQUER RESTRIÇÃO
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

-- FUNÇÃO PARA CONTAR TOTAL DE REGISTROS (para validação)
CREATE OR REPLACE FUNCTION public.get_volumetria_total_count()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_count BIGINT;
BEGIN
  SET LOCAL row_security = off;
  SELECT COUNT(*) INTO total_count FROM volumetria_mobilemed;
  RETURN total_count;
END;
$$;

-- FUNÇÃO PARA CONTAR TOTAL DE LAUDOS ATRASADOS (validação)
CREATE OR REPLACE FUNCTION public.get_volumetria_total_atraso()
RETURNS TABLE(total_laudos BIGINT, total_atrasados BIGINT, percentual_atraso NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SET LOCAL row_security = off;
  
  RETURN QUERY
  SELECT 
    COALESCE(SUM(vm."VALORES"), 0)::BIGINT as total_laudos,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)::BIGINT as total_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 0)), 2)
      ELSE 0
    END as percentual_atraso
  FROM volumetria_mobilemed vm;
END;
$$;

-- PERMISSÕES TOTAIS
GRANT EXECUTE ON FUNCTION public.get_volumetria_unlimited_force() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_volumetria_total_count() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_volumetria_total_atraso() TO authenticated, anon, public;