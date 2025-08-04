-- Aplicar regras de exclusão por período para arquivos retroativos existentes
-- Para Jun/25: excluir DATA_REALIZACAO >= 2025-06-01 e DATA_LAUDO fora de 2025-06-08 a 2025-07-07

-- Excluir registros com DATA_REALIZACAO >= 2025-06-01
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo'
  AND "DATA_REALIZACAO" >= '2025-06-01';

-- Excluir registros com DATA_LAUDO fora do período de faturamento (2025-06-08 a 2025-07-07)
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo'
  AND ("DATA_LAUDO" < '2025-06-08' OR "DATA_LAUDO" > '2025-07-07');