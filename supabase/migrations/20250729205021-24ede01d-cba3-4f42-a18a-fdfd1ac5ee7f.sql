-- Permitir valores NULL nas colunas de categoria
-- Isso resolve os erros de upload quando a categoria não é informada

-- Alterar tabela cadastro_exames para permitir categoria NULL
ALTER TABLE public.cadastro_exames 
ALTER COLUMN categoria DROP NOT NULL;

-- Alterar tabela regras_quebra_exames para permitir categoria_quebrada NULL
ALTER TABLE public.regras_quebra_exames 
ALTER COLUMN categoria_quebrada DROP NOT NULL;

-- Comentários sobre as mudanças
COMMENT ON COLUMN public.cadastro_exames.categoria IS 'Categoria do exame - pode ser NULL quando não informada no upload';
COMMENT ON COLUMN public.regras_quebra_exames.categoria_quebrada IS 'Categoria do exame quebrado - pode ser NULL quando não informada no upload';