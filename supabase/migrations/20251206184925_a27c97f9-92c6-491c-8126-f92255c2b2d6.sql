-- Inserir categoria SC (Sem Categoria) no cadastro de categorias_exame
INSERT INTO categorias_exame (nome, descricao, ativo, ordem)
VALUES ('SC', 'Sem Categoria - Exames que não possuem categoria específica', true, 99)
ON CONFLICT DO NOTHING;