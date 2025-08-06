-- CONFIGURAÇÃO GLOBAL PARA ELIMINAR TODAS AS LIMITAÇÕES DO SUPABASE

-- 1. RECRIAR FUNÇÃO COM CONFIGURAÇÕES MÁXIMAS
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
  -- CONFIGURAÇÕES MÁXIMAS PARA GARANTIR ZERO LIMITAÇÕES
  SET LOCAL row_security = off;
  SET LOCAL statement_timeout = 0;
  SET LOCAL work_mem = '8GB';
  SET LOCAL effective_cache_size = '16GB';
  SET LOCAL shared_buffers = '4GB';
  SET LOCAL max_parallel_workers_per_gather = 16;
  SET LOCAL max_parallel_workers = 32;
  SET LOCAL parallel_tuple_cost = 0.1;
  SET LOCAL parallel_setup_cost = 1000;
  SET LOCAL enable_parallel_append = on;
  SET LOCAL enable_parallel_hash = on;
  SET LOCAL jit = off; -- Desabilitar JIT para evitar overhead
  
  -- RETORNAR ABSOLUTAMENTE TODOS OS DADOS - ZERO LIMITAÇÕES
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

-- 2. CRIAR FUNÇÃO ALTERNATIVA SEM QUALQUER RESTRIÇÃO
CREATE OR REPLACE FUNCTION public.get_volumetria_unlimited()
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
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- 3. FUNÇÃO PARA CONTAGEM TOTAL SEM LIMITAÇÕES
CREATE OR REPLACE FUNCTION public.get_volumetria_total_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*) FROM volumetria_mobilemed;
$$;

-- 4. GARANTIR PERMISSÕES TOTAIS PARA TODAS AS FUNÇÕES
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_volumetria_complete_data() TO anon;
GRANT EXECUTE ON FUNCTION public.get_volumetria_unlimited() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_volumetria_unlimited() TO anon;
GRANT EXECUTE ON FUNCTION public.get_volumetria_total_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_volumetria_total_count() TO anon;

-- 5. DESABILITAR COMPLETAMENTE RLS NA TABELA VOLUMETRIA_MOBILEMED PARA FUNÇÕES
ALTER TABLE volumetria_mobilemed DISABLE ROW LEVEL SECURITY;

-- 6. CRIAR POLÍTICA UNIVERSAL DE ACESSO (CASO RLS SEJA REABILITADO)
DROP POLICY IF EXISTS "Acesso_total_volumetria" ON volumetria_mobilemed;
CREATE POLICY "Acesso_total_volumetria" ON volumetria_mobilemed 
  FOR ALL USING (true) WITH CHECK (true);

-- 7. REABILITAR RLS MAS COM POLÍTICA UNIVERSAL
ALTER TABLE volumetria_mobilemed ENABLE ROW LEVEL SECURITY;

-- 8. CONFIGURAÇÕES GLOBAIS DE PERFORMANCE (SE APLICÁVEL)
-- Estas configurações podem precisar de privilégios de superusuário

-- CRIAR FUNÇÃO DE DIAGNÓSTICO PARA VERIFICAR LIMITAÇÕES
CREATE OR REPLACE FUNCTION public.diagnosticar_limitacoes_supabase()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_registros bigint;
  config_info jsonb;
BEGIN
  -- Contar registros
  SELECT COUNT(*) INTO total_registros FROM volumetria_mobilemed;
  
  -- Coletar informações de configuração
  config_info := jsonb_build_object(
    'total_registros_volumetria', total_registros,
    'rls_habilitado', (SELECT current_setting('row_security')),
    'work_mem', (SELECT current_setting('work_mem')),
    'statement_timeout', (SELECT current_setting('statement_timeout')),
    'max_parallel_workers', (SELECT current_setting('max_parallel_workers')),
    'data_verificacao', now()
  );
  
  RETURN config_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnosticar_limitacoes_supabase() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnosticar_limitacoes_supabase() TO anon;