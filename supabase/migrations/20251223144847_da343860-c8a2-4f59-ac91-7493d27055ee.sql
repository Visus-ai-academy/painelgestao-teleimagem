-- Adicionar coluna progresso_fase que está faltando
ALTER TABLE public.processamento_regras_log 
ADD COLUMN IF NOT EXISTS progresso_fase jsonb DEFAULT NULL;