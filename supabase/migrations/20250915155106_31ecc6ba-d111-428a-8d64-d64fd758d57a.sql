-- Adicionar colunas para controle de geração de NF no Omie na tabela relatorios_faturamento_status
ALTER TABLE relatorios_faturamento_status 
ADD COLUMN IF NOT EXISTS omie_nf_gerada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS omie_codigo_pedido TEXT,
ADD COLUMN IF NOT EXISTS omie_numero_pedido TEXT,
ADD COLUMN IF NOT EXISTS data_geracao_nf_omie TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS omie_detalhes JSONB;