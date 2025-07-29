-- Criar tabela para controle de uploads
CREATE TABLE IF NOT EXISTS public.processamento_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_arquivo TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando',
  registros_processados INTEGER NOT NULL DEFAULT 0,
  registros_inseridos INTEGER NOT NULL DEFAULT 0,
  registros_atualizados INTEGER NOT NULL DEFAULT 0,
  registros_erro INTEGER NOT NULL DEFAULT 0,
  detalhes_erro JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Habilitar RLS
ALTER TABLE public.processamento_uploads ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Managers podem ver todos os uploads"
ON public.processamento_uploads
FOR SELECT
USING (is_manager_or_admin());

CREATE POLICY "Sistema pode inserir uploads"
ON public.processamento_uploads
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar uploads"
ON public.processamento_uploads
FOR UPDATE
USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_processamento_uploads_tipo_arquivo ON public.processamento_uploads(tipo_arquivo);
CREATE INDEX IF NOT EXISTS idx_processamento_uploads_status ON public.processamento_uploads(status);
CREATE INDEX IF NOT EXISTS idx_processamento_uploads_created_at ON public.processamento_uploads(created_at DESC);