-- Atualizar constraint para aceitar os novos tipos de arquivo_fonte
ALTER TABLE volumetria_mobilemed DROP CONSTRAINT IF EXISTS volumetria_mobilemed_arquivo_fonte_check;

-- Criar novo constraint com os 4 tipos de volumetria
ALTER TABLE volumetria_mobilemed ADD CONSTRAINT volumetria_mobilemed_arquivo_fonte_check 
CHECK (arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'));