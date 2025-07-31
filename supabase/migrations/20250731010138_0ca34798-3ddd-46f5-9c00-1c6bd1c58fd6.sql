-- Limpar dados duplicados de Volumetria Padrão
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao';

-- Limpar status de processamento relacionado
DELETE FROM processamento_uploads 
WHERE tipo_arquivo = 'volumetria_padrao';