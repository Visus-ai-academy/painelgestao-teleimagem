-- Adicionar coluna tipo_faturamento à tabela contratos_clientes
ALTER TABLE public.contratos_clientes 
ADD COLUMN tipo_faturamento text NOT NULL DEFAULT 'CO-FT';