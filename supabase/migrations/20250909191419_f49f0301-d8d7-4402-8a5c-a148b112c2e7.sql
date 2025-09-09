-- Adicionar campos ACCESSION_NUMBER e cliente_nome_original na tabela faturamento
ALTER TABLE faturamento 
ADD COLUMN IF NOT EXISTS accession_number TEXT,
ADD COLUMN IF NOT EXISTS cliente_nome_original TEXT;

-- Criar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_faturamento_accession_number ON faturamento(accession_number);
CREATE INDEX IF NOT EXISTS idx_faturamento_cliente_nome_original ON faturamento(cliente_nome_original);

-- Comentários para documentar os novos campos
COMMENT ON COLUMN faturamento.accession_number IS 'Número do ACCESSION_NUMBER do exame original na volumetria';
COMMENT ON COLUMN faturamento.cliente_nome_original IS 'Nome original da empresa antes da transformação para nome fantasia (campo EMPRESA da volumetria)';