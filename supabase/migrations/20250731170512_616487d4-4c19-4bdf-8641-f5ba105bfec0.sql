-- Limpar o registro de teste inserido anteriormente
DELETE FROM volumetria_mobilemed 
WHERE "EMPRESA" = 'TESTE EMPRESA' 
  AND "NOME_PACIENTE" = 'TESTE PACIENTE' 
  AND arquivo_fonte = 'volumetria_padrao'
  AND "VALORES" = 100;