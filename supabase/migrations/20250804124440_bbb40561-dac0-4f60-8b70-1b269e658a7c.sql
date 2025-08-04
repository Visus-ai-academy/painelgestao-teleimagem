-- Atualizar constraint da tabela volumetria_mobilemed para incluir volumetria_onco_padrao
ALTER TABLE volumetria_mobilemed 
DROP CONSTRAINT IF EXISTS volumetria_mobilemed_arquivo_fonte_check;

ALTER TABLE volumetria_mobilemed 
ADD CONSTRAINT volumetria_mobilemed_arquivo_fonte_check 
CHECK (arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao'));