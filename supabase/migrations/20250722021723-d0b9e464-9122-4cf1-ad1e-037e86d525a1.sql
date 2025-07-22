-- Temporariamente remover a constraint única para permitir upload
DROP INDEX IF EXISTS public.idx_clientes_nome_email;

-- Recriar um índice simples sem constraint única
CREATE INDEX idx_clientes_nome_email_simple ON public.clientes (nome, email) WHERE ((ativo = true) AND (email IS NOT NULL));