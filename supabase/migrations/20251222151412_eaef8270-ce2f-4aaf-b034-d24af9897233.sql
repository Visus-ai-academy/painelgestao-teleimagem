-- Criar tabela para log de processamento de regras
CREATE TABLE IF NOT EXISTS public.processamento_regras_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo_fonte TEXT NOT NULL,
  periodo_referencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  registros_antes INTEGER,
  registros_depois INTEGER,
  registros_excluidos INTEGER,
  regras_aplicadas TEXT[],
  mensagem TEXT,
  erro TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processamento_regras_log ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
CREATE POLICY "Authenticated users can manage processamento_regras_log"
ON public.processamento_regras_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_processamento_regras_log_status ON public.processamento_regras_log(status);
CREATE INDEX IF NOT EXISTS idx_processamento_regras_log_arquivo ON public.processamento_regras_log(arquivo_fonte);
CREATE INDEX IF NOT EXISTS idx_processamento_regras_log_created ON public.processamento_regras_log(created_at DESC);