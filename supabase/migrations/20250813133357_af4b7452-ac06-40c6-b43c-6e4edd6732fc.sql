-- Criar tabela para histórico de versões de contratos
CREATE TABLE IF NOT EXISTS public.historico_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos_clientes(id) ON DELETE CASCADE,
  data_vigencia_inicio DATE NOT NULL,
  data_vigencia_fim DATE,
  tipo_alteracao TEXT NOT NULL DEFAULT 'edicao', -- 'edicao', 'renovacao', 'termo_aditivo'
  descricao_alteracao TEXT,
  dados_anteriores JSONB NOT NULL,
  dados_novos JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  aplicado_em TIMESTAMP WITH TIME ZONE
);

-- RLS para histórico de contratos
ALTER TABLE public.historico_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar histórico contratos"
ON public.historico_contratos FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Managers podem ver histórico contratos"
ON public.historico_contratos FOR SELECT
USING (public.is_manager_or_admin());

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_historico_contratos_contrato_id ON public.historico_contratos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_historico_contratos_data_vigencia ON public.historico_contratos(data_vigencia_inicio, data_vigencia_fim);

-- Trigger para auditoria
CREATE TRIGGER audit_historico_contratos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.historico_contratos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();