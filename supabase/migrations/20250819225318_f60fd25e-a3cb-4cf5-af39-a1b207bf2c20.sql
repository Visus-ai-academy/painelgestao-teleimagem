-- CORREÇÃO 1: Criar função RPC que está faltando
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
RETURNS TABLE(
  empresa text,
  total_exames numeric,
  total_registros numeric,
  total_atrasados numeric,
  percentual_atraso numeric,
  modalidades_unicas text[],
  especialidades_unicas text[],
  medicos_unicos text[],
  valor_medio_exame numeric,
  periodo_referencia text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA" as empresa,
    COALESCE(SUM(vm."VALORES"), 0) as total_exames,
    COUNT(*)::numeric as total_registros,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0) as total_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 1)), 1)
      ELSE 0
    END as percentual_atraso,
    ARRAY_AGG(DISTINCT vm."MODALIDADE") FILTER (WHERE vm."MODALIDADE" IS NOT NULL) as modalidades_unicas,
    ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FILTER (WHERE vm."ESPECIALIDADE" IS NOT NULL) as especialidades_unicas,
    ARRAY_AGG(DISTINCT vm."MEDICO") FILTER (WHERE vm."MEDICO" IS NOT NULL) as medicos_unicos,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(vm."VALORES"), 0) / COUNT(*)::numeric, 2)
      ELSE 0
    END as valor_medio_exame,
    vm.periodo_referencia
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte NOT IN ('volumetria_onco_padrao') -- Excluir onco dos stats gerais
  GROUP BY vm."EMPRESA", vm.periodo_referencia
  HAVING COUNT(*) > 0
  ORDER BY total_exames DESC;
END;
$$;

-- CORREÇÃO 2: Criar tabela para controle de processamento streaming
CREATE TABLE IF NOT EXISTS public.processamento_streaming (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid NOT NULL,
  arquivo_fonte text NOT NULL,
  chunk_atual integer DEFAULT 0,
  total_chunks integer DEFAULT 0,
  registros_por_chunk integer DEFAULT 1000,
  status text NOT NULL DEFAULT 'iniciado'::text,
  progresso_percentage numeric DEFAULT 0,
  tempo_inicio timestamp with time zone DEFAULT now(),
  tempo_fim timestamp with time zone,
  erro_detalhes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.processamento_streaming ENABLE ROW LEVEL SECURITY;

-- Política para admins (especificando o tipo uuid explicitamente)
CREATE POLICY "Admins podem gerenciar streaming" 
ON public.processamento_streaming 
FOR ALL 
USING (public.is_admin(auth.uid()::uuid)) 
WITH CHECK (public.is_admin(auth.uid()::uuid));