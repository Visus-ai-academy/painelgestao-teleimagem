-- Adicionar campos de faturamento conforme mapeamento
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS paciente text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS medico text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS data_exame date;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS modalidade text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS especialidade text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS prioridade text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS nome_exame text;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS quantidade integer DEFAULT 1;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS valor_bruto numeric DEFAULT 0;
ALTER TABLE public.faturamento ADD COLUMN IF NOT EXISTS cliente text;