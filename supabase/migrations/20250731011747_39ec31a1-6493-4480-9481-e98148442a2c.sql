-- Limpar dados de volumetria padrão e de-para
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte IN (
  'volumetria_padrao',
  'de_para_exames',
  'valores_de_para'
);

-- Limpar tabela de valores de referência de-para
DELETE FROM valores_referencia_de_para;

-- Limpar status de processamento
DELETE FROM processamento_uploads 
WHERE tipo_arquivo IN (
  'volumetria_padrao',
  'de_para_exames', 
  'valores_de_para'
);