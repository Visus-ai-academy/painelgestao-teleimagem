-- 1) Add CLIENTE column to volumetria_mobilemed and annotate EMPRESA as UNIDADE_ORIGEM
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'volumetria_mobilemed' AND column_name = 'CLIENTE'
  ) THEN
    ALTER TABLE public.volumetria_mobilemed ADD COLUMN "CLIENTE" text;
  END IF;
END $$;

COMMENT ON COLUMN public.volumetria_mobilemed."EMPRESA" IS 'UNIDADE_ORIGEM - nome original da unidade/empresa de origem do upload';
COMMENT ON COLUMN public.volumetria_mobilemed."CLIENTE" IS 'Nome do CLIENTE considerado para filtros, faturamento e relatórios (derivado de De-Para_nome_unidade ou igual à UNIDADE_ORIGEM)';

-- 2) Create de-para table for unidade->cliente mapping
CREATE TABLE IF NOT EXISTS public.de_para_nome_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_unidade text UNIQUE NOT NULL,
  cliente text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.de_para_nome_unidade ENABLE ROW LEVEL SECURITY;

-- Policies: admins manage, managers read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'de_para_nome_unidade' AND policyname = 'Admins podem gerenciar de-para nome unidade'
  ) THEN
    CREATE POLICY "Admins podem gerenciar de-para nome unidade"
    ON public.de_para_nome_unidade
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'de_para_nome_unidade' AND policyname = 'Managers podem ver de-para nome unidade'
  ) THEN
    CREATE POLICY "Managers podem ver de-para nome unidade"
    ON public.de_para_nome_unidade
    FOR SELECT
    USING (public.is_manager_or_admin());
  END IF;
END $$;

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_de_para_nome_unidade_updated_at'
  ) THEN
    CREATE TRIGGER update_de_para_nome_unidade_updated_at
    BEFORE UPDATE ON public.de_para_nome_unidade
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3) Helper function and trigger to populate CLIENTE
CREATE OR REPLACE FUNCTION public.map_cliente_unidade(p_unidade text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE v_cliente text;
BEGIN
  SELECT dpu.cliente INTO v_cliente
  FROM public.de_para_nome_unidade dpu
  WHERE dpu.origem_unidade = p_unidade AND dpu.ativo = true
  LIMIT 1;
  RETURN COALESCE(v_cliente, p_unidade);
END; $$;

CREATE OR REPLACE FUNCTION public.set_cliente_from_unidade_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Preencher CLIENTE a partir da origem
  IF TG_OP = 'INSERT' THEN
    NEW."CLIENTE" := public.map_cliente_unidade(NEW."EMPRESA");
  ELSIF TG_OP = 'UPDATE' AND NEW."EMPRESA" IS DISTINCT FROM OLD."EMPRESA" THEN
    NEW."CLIENTE" := public.map_cliente_unidade(NEW."EMPRESA");
  END IF;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'volumetria_set_cliente_before_ins_upd'
  ) THEN
    CREATE TRIGGER volumetria_set_cliente_before_ins_upd
    BEFORE INSERT OR UPDATE OF "EMPRESA" ON public.volumetria_mobilemed
    FOR EACH ROW EXECUTE FUNCTION public.set_cliente_from_unidade_trigger();
  END IF;
END $$;

-- 4) Backfill existing data
UPDATE public.volumetria_mobilemed vm
SET "CLIENTE" = COALESCE(dpu.cliente, vm."EMPRESA")
FROM public.de_para_nome_unidade dpu
WHERE dpu.origem_unidade = vm."EMPRESA" AND dpu.ativo = true;

UPDATE public.volumetria_mobilemed
SET "CLIENTE" = COALESCE("CLIENTE", "EMPRESA")
WHERE "CLIENTE" IS NULL OR "CLIENTE" = '';

-- 5) Index to speed up filtering by CLIENTE
CREATE INDEX IF NOT EXISTS idx_volumetria_cliente ON public.volumetria_mobilemed("CLIENTE");

-- 6) Update dashboard functions to use CLIENTE instead of EMPRESA
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
  SET LOCAL row_security = off;
  SET LOCAL work_mem = '256MB';
  
  SELECT 
    COALESCE(SUM(vm."VALORES"), 0),
    COUNT(*),
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0)
  INTO total_exames_calc, total_registros_calc, total_atrasados_calc
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao');
  
  percentual_atraso_calc := CASE 
    WHEN total_exames_calc > 0 THEN 
      ROUND((total_atrasados_calc * 100.0 / total_exames_calc), 1)
    ELSE 0
  END;
  
  RETURN QUERY
  SELECT 
    total_exames_calc,
    total_registros_calc,
    total_atrasados_calc,
    percentual_atraso_calc,
    (SELECT COUNT(DISTINCT c.id) FROM clientes c WHERE c.ativo = true)::numeric,
    (SELECT COUNT(DISTINCT vm."CLIENTE") FROM volumetria_mobilemed vm WHERE vm."CLIENTE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT COUNT(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'))::numeric,
    (SELECT ARRAY_AGG(DISTINCT vm."CLIENTE") FROM volumetria_mobilemed vm WHERE vm."CLIENTE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."MODALIDADE") FROM volumetria_mobilemed vm WHERE vm."MODALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FROM volumetria_mobilemed vm WHERE vm."ESPECIALIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."PRIORIDADE") FROM volumetria_mobilemed vm WHERE vm."PRIORIDADE" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')),
    (SELECT ARRAY_AGG(DISTINCT vm."MEDICO") FROM volumetria_mobilemed vm WHERE vm."MEDICO" IS NOT NULL AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao'));
END;
$function$;

-- Atualizar função de clientes com volumetria para usar CLIENTE
CREATE OR REPLACE FUNCTION public.get_clientes_com_volumetria()
 RETURNS TABLE(id uuid, nome text, endereco text, cidade text, estado text, status text, ativo boolean, contato text, telefone text, email text, cnpj text, volume_exames bigint, total_registros bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.endereco,
    c.cidade,
    c.estado,
    c.status,
    c.ativo,
    c.contato,
    c.telefone,
    c.email,
    c.cnpj,
    COALESCE(v.volume_exames, 0) as volume_exames,
    COALESCE(v.total_registros, 0) as total_registros
  FROM clientes c
  LEFT JOIN (
    SELECT 
      "CLIENTE" as nome_cliente,
      SUM("VALORES") as volume_exames,
      COUNT(*) as total_registros
    FROM volumetria_mobilemed 
    WHERE "CLIENTE" IS NOT NULL 
    GROUP BY "CLIENTE"
  ) v ON c.nome = v.nome_cliente
  WHERE c.ativo = true
  ORDER BY v.volume_exames DESC NULLS LAST;
END;
$function$;

-- Atualizar função de tempo médio de atraso por cliente
CREATE OR REPLACE FUNCTION public.get_tempo_medio_atraso_clientes()
 RETURNS TABLE("CLIENTE" text, tempo_medio_atraso_horas numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  SET LOCAL row_security = off;
  RETURN QUERY
  SELECT 
    vm."CLIENTE",
    AVG(
      EXTRACT(EPOCH FROM (
        (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) - 
        (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      )) / 3600
    )::numeric as tempo_medio_atraso_horas
  FROM volumetria_mobilemed vm
  WHERE vm."CLIENTE" IS NOT NULL
    AND vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
  GROUP BY vm."CLIENTE"
  HAVING COUNT(*) > 0;
END;
$function$;
