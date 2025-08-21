-- Garantir que a tabela registros_rejeitados_processamento tenha RLS adequada

-- Verificar e ajustar RLS para registros_rejeitados_processamento
ALTER TABLE public.registros_rejeitados_processamento ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins e managers podem ver registros rejeitados" ON public.registros_rejeitados_processamento;
DROP POLICY IF EXISTS "Sistema pode inserir registros rejeitados" ON public.registros_rejeitados_processamento;

-- Política para admins e managers poderem ver todos os registros rejeitados
CREATE POLICY "Admins e managers podem ver registros rejeitados" 
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
CREATE POLICY "Sistema pode inserir registros rejeitados" 
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