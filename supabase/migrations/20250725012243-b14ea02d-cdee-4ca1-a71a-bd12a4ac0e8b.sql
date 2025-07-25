-- Adicionar campos cidade e estado na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT;