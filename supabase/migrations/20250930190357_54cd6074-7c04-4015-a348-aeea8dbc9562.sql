-- Criar tabela para registrar duplicados de repasse médico
CREATE TABLE IF NOT EXISTS public.duplicados_repasse_medico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid,
  medico_nome text,
  modalidade text,
  especialidade text,
  prioridade text,
  categoria text,
  cliente_id uuid,
  cliente_nome text,
  valores_diferentes jsonb[], -- Array com os diferentes valores encontrados
  quantidade_duplicados integer DEFAULT 0,
  lote_processamento text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_duplicados_repasse_chave 
ON public.duplicados_repasse_medico(medico_id, modalidade, especialidade, prioridade, categoria, cliente_id);

-- RLS policies
ALTER TABLE public.duplicados_repasse_medico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar duplicados repasse"
ON public.duplicados_repasse_medico
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Managers podem ver duplicados repasse"
ON public.duplicados_repasse_medico
FOR SELECT
USING (is_manager_or_admin(auth.uid()));