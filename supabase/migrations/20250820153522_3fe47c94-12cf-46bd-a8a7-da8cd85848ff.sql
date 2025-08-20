-- Tabela para armazenar o status dos relatórios de faturamento gerados
CREATE TABLE public.relatorios_faturamento_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL,
  cliente_nome TEXT NOT NULL,
  periodo TEXT NOT NULL,
  relatorio_gerado BOOLEAN DEFAULT false,
  email_enviado BOOLEAN DEFAULT false,
  email_destino TEXT,
  link_relatorio TEXT,
  erro TEXT,
  erro_email TEXT,
  data_processamento TIMESTAMP WITH TIME ZONE,
  data_geracao_relatorio TIMESTAMP WITH TIME ZONE,
  data_envio_email TIMESTAMP WITH TIME ZONE,
  detalhes_relatorio JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, periodo)
);

-- Habilitar RLS
ALTER TABLE public.relatorios_faturamento_status ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para permitir acesso aos dados
CREATE POLICY "Permitir leitura dos relatórios de faturamento"
  ON public.relatorios_faturamento_status
  FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção dos relatórios de faturamento"
  ON public.relatorios_faturamento_status
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização dos relatórios de faturamento"
  ON public.relatorios_faturamento_status
  FOR UPDATE
  USING (true);

CREATE POLICY "Permitir exclusão dos relatórios de faturamento"
  ON public.relatorios_faturamento_status
  FOR DELETE
  USING (true);

-- Função para atualizar o timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_relatorios_faturamento_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualização automática do timestamp
CREATE TRIGGER update_relatorios_faturamento_status_updated_at
  BEFORE UPDATE ON public.relatorios_faturamento_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_relatorios_faturamento_status_updated_at();

-- Índices para melhor performance
CREATE INDEX idx_relatorios_faturamento_status_cliente_periodo 
  ON public.relatorios_faturamento_status(cliente_id, periodo);
CREATE INDEX idx_relatorios_faturamento_status_periodo 
  ON public.relatorios_faturamento_status(periodo);
CREATE INDEX idx_relatorios_faturamento_status_relatorio_gerado 
  ON public.relatorios_faturamento_status(relatorio_gerado);
CREATE INDEX idx_relatorios_faturamento_status_email_enviado 
  ON public.relatorios_faturamento_status(email_enviado);