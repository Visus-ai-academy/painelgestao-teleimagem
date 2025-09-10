-- Adicionar campo status à tabela parametros_faturamento
ALTER TABLE public.parametros_faturamento 
ADD COLUMN status VARCHAR(1) DEFAULT 'A' CHECK (status IN ('I', 'A', 'C'));

-- Comentário na coluna para documentar os valores
COMMENT ON COLUMN public.parametros_faturamento.status IS 'Status do parâmetro: I=Inativo, A=Ativo, C=Cancelado';

-- Migrar dados existentes do campo ativo para o novo campo status
UPDATE public.parametros_faturamento 
SET status = CASE 
  WHEN ativo = true THEN 'A'
  ELSE 'I'
END;