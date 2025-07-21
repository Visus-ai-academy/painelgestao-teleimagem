-- Desabilitar temporariamente os triggers e excluir registros de faturamento
SET session_replication_role = replica;

DELETE FROM faturamento 
WHERE DATE_TRUNC('month', data_emissao) = DATE_TRUNC('month', CURRENT_DATE);

SET session_replication_role = DEFAULT;

-- Verificar se a exclusão foi bem-sucedida
SELECT COUNT(*) as registros_restantes FROM faturamento;