-- Tabela para gerenciar fila de sincronização OMIE
CREATE TABLE IF NOT EXISTS public.fila_sincronizacao_omie (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cnpj TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro', 'nao_encontrado')),
  omie_codigo_cliente TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_fila_sincronizacao_status ON public.fila_sincronizacao_omie(status);
CREATE INDEX IF NOT EXISTS idx_fila_sincronizacao_cliente ON public.fila_sincronizacao_omie(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fila_sincronizacao_created ON public.fila_sincronizacao_omie(created_at);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_fila_sincronizacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fila_sincronizacao_updated_at
  BEFORE UPDATE ON public.fila_sincronizacao_omie
  FOR EACH ROW
  EXECUTE FUNCTION update_fila_sincronizacao_updated_at();

-- RLS Policies
ALTER TABLE public.fila_sincronizacao_omie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura da fila para usuários autenticados"
  ON public.fila_sincronizacao_omie
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserção na fila para usuários autenticados"
  ON public.fila_sincronizacao_omie
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir atualização da fila para usuários autenticados"
  ON public.fila_sincronizacao_omie
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Permitir exclusão da fila para usuários autenticados"
  ON public.fila_sincronizacao_omie
  FOR DELETE
  TO authenticated
  USING (true);