-- Garantir que a tabela clientes tenha todos os campos do mapeamento
-- Adicionar campo contato como alias para telefone se necessário
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS contato text;

-- Garantir que a tabela faturamento tenha todos os campos do mapeamento
-- Corrigir nome do campo nome_exame
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS nome_exame text;

-- Garantir que o campo Cliente existe na tabela faturamento
-- (já foi adicionado na migração anterior, mas garantindo)
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS cliente text;