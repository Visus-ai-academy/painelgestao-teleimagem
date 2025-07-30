-- Limpar dados dos uploads MobileMed (arquivos 1, 2, 3 e 4)
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo');

-- Limpar dados da tabela De Para de exames fora do padrão
DELETE FROM valores_referencia_de_para;

-- Limpar registros de processamento relacionados
DELETE FROM processamento_uploads 
WHERE tipo_arquivo IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'valores_de_para');