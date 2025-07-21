-- Adicionar campos faltantes na tabela clientes baseados no template
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_termino_vigencia DATE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cod_cliente TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS contato TEXT;