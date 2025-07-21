-- Excluir registros de faturamento do mês atual
DELETE FROM faturamento 
WHERE DATE_TRUNC('month', data_emissao) = DATE_TRUNC('month', CURRENT_DATE);