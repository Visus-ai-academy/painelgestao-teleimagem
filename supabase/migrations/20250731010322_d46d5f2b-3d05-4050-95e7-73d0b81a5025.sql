-- Limpar dados de volumetria e de-para solicitados
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte IN (
  'volumetria_fora_padrao',
  'volumetria_padrao_retroativo', 
  'volumetria_fora_padrao_retroativo'
);

-- Limpar tabela de valores de referência de-para
DELETE FROM valores_referencia_de_para;

-- Limpar status de processamento relacionados
DELETE FROM processamento_uploads 
WHERE tipo_arquivo IN (
  'volumetria_fora_padrao',
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo',
  'de_para_exames',
  'valores_de_para'
);