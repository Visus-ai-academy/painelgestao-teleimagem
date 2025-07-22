-- Remover o campo status da tabela faturamento
-- Este campo não existe no arquivo de upload e estava causando erros

ALTER TABLE public.faturamento DROP COLUMN IF EXISTS status;