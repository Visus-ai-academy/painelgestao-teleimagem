-- Remover os dados de teste inseridos anteriormente
-- Manter apenas os uploads reais realizados pelos usuários

DELETE FROM processamento_uploads 
WHERE arquivo_nome LIKE '%_teste.xlsx';