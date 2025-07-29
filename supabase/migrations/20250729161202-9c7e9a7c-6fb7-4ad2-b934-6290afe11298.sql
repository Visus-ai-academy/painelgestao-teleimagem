-- Inserir categoria padrão "GERAL" se não existir
INSERT INTO categorias_exame (nome, descricao, ativo, ordem)
SELECT 'GERAL', 'Categoria geral para exames sem categoria específica', true, 999
WHERE NOT EXISTS (SELECT 1 FROM categorias_exame WHERE nome ILIKE 'GERAL');