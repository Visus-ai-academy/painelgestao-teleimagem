-- Adicionar coluna cond_volume na tabela precos_servicos para armazenar condição de volume por linha de preço
-- Valores possíveis: 'MOD', 'MOD/ESP', 'MOD/ESP/CAT', 'TOTAL'

ALTER TABLE precos_servicos 
ADD COLUMN IF NOT EXISTS cond_volume text;

COMMENT ON COLUMN precos_servicos.cond_volume IS 'Condição de agrupamento para cálculo de volume: MOD (modalidade), MOD/ESP (modalidade+especialidade), MOD/ESP/CAT (modalidade+especialidade+categoria), TOTAL (todos exames)';

-- Criar índice para melhorar performance nas buscas
CREATE INDEX IF NOT EXISTS idx_precos_servicos_cond_volume 
ON precos_servicos(cond_volume) 
WHERE cond_volume IS NOT NULL;