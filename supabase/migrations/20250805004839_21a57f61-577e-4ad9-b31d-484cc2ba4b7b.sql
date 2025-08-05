-- Remover colunas de datas da tabela precos_servicos
ALTER TABLE public.precos_servicos 
DROP COLUMN IF EXISTS data_inicio_vigencia,
DROP COLUMN IF EXISTS data_fim_vigencia;