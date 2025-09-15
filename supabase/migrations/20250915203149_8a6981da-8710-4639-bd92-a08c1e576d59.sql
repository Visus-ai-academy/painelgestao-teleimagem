-- Adicionar colunas para armazenar códigos reais do Omie
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS omie_codigo_cliente TEXT,
ADD COLUMN IF NOT EXISTS omie_data_sincronizacao TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.contratos_clientes 
ADD COLUMN IF NOT EXISTS omie_codigo_cliente TEXT,
ADD COLUMN IF NOT EXISTS omie_codigo_contrato TEXT,
ADD COLUMN IF NOT EXISTS omie_data_sincronizacao TIMESTAMP WITH TIME ZONE;

-- Comentários para documentar o uso
COMMENT ON COLUMN public.clientes.omie_codigo_cliente IS 'Código real do cliente no sistema Omie (obtido via CNPJ)';
COMMENT ON COLUMN public.clientes.omie_data_sincronizacao IS 'Data da última sincronização com o Omie';
COMMENT ON COLUMN public.contratos_clientes.omie_codigo_cliente IS 'Código real do cliente no Omie vinculado a este contrato';
COMMENT ON COLUMN public.contratos_clientes.omie_codigo_contrato IS 'Código real do contrato no sistema Omie';
COMMENT ON COLUMN public.contratos_clientes.omie_data_sincronizacao IS 'Data da última sincronização do contrato com o Omie';