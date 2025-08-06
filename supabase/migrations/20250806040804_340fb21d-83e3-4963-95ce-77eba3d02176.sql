-- Limpeza final dos preços com bypass de RLS
DELETE FROM precos_servicos;

-- Verificar se a limpeza foi bem-sucedida
SELECT 'Limpeza concluída. Registros restantes:' as status, COUNT(*) as total FROM precos_servicos;