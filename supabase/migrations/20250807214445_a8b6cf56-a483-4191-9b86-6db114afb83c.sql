-- Adicionar coluna tipo_faturamento na tabela volumetria_mobilemed
ALTER TABLE volumetria_mobilemed 
ADD COLUMN IF NOT EXISTS tipo_faturamento TEXT;

-- Criar índice para otimizar consultas por tipo de faturamento
CREATE INDEX IF NOT EXISTS idx_volumetria_tipo_faturamento 
ON volumetria_mobilemed(tipo_faturamento);

-- Adicionar coluna tipo_faturamento na tabela faturamento
ALTER TABLE faturamento 
ADD COLUMN IF NOT EXISTS tipo_faturamento TEXT;

-- Criar índice para faturamento
CREATE INDEX IF NOT EXISTS idx_faturamento_tipo_faturamento 
ON faturamento(tipo_faturamento);