-- Garantir que todas as tabelas tenham os campos dos mapeamentos

-- TABELA CLIENTES - todos os campos já existem

-- TABELA ESCALAS_MEDICAS - todos os campos já existem

-- TABELA EXAMES - todos os campos já existem

-- TABELA FATURAMENTO - adicionar campo Cliente (diferente de cliente_nome)
-- O mapeamento tem "Cliente" mas a tabela tem "cliente_nome" e "cliente"
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS cliente_id uuid;

-- TABELA MEDICOS - todos os campos já existem

-- Comentário: Todas as tabelas agora possuem os campos conforme seus mapeamentos