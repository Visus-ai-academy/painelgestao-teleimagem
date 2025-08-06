-- Aplicar filtro manual de DATA_LAUDO para junho/2025
-- Excluir registros com DATA_LAUDO > 2025-07-07 dos arquivos não-retroativos

DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_onco_padrao')
  AND "DATA_LAUDO" > '2025-07-07';