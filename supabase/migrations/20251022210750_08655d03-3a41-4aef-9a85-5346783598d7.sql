-- Permitir que contratos sem número fiquem em branco (NULL)
ALTER TABLE public.contratos_clientes
ALTER COLUMN numero_contrato DROP NOT NULL;