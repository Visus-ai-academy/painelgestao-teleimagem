-- APLICAR REGRA V003: Excluir registros com DATA_REALIZACAO >= 01/06/2025
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND "DATA_REALIZACAO" >= '2025-06-01';

-- APLICAR REGRA V002: Excluir registros com DATA_LAUDO fora da janela 08/06/2025 - 07/07/2025  
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND ("DATA_LAUDO" < '2025-06-08' OR "DATA_LAUDO" > '2025-07-07');