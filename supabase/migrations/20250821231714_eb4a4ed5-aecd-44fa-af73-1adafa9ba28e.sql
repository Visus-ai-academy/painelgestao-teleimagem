-- Garantir que a tabela registros_rejeitados_processamento tenha RLS adequada
-- e verificar se precisa de ajustes

-- Verificar e ajustar RLS para registros_rejeitados_processamento
ALTER TABLE public.registros_rejeitados_processamento ENABLE ROW LEVEL SECURITY;

-- Política para admins e managers poderem ver todos os registros rejeitados
CREATE POLICY IF NOT EXISTS "Admins e managers podem ver registros rejeitados" 
ON public.registros_rejeitados_processamento 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  )
);

-- Política para sistema poder inserir registros rejeitados (edge functions)
CREATE POLICY IF NOT EXISTS "Sistema pode inserir registros rejeitados" 
ON public.registros_rejeitados_processamento 
FOR INSERT 
WITH CHECK (true);

-- Criar índices para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_arquivo_fonte 
ON public.registros_rejeitados_processamento(arquivo_fonte);

CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_lote_upload 
ON public.registros_rejeitados_processamento(lote_upload);

CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_created_at 
ON public.registros_rejeitados_processamento(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_motivo 
ON public.registros_rejeitados_processamento(motivo_rejeicao);