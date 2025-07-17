-- Add new columns to faturamento table to store detailed information
ALTER TABLE public.faturamento 
ADD COLUMN IF NOT EXISTS paciente TEXT,
ADD COLUMN IF NOT EXISTS medico TEXT,
ADD COLUMN IF NOT EXISTS data_exame DATE,
ADD COLUMN IF NOT EXISTS modalidade TEXT,
ADD COLUMN IF NOT EXISTS especialidade TEXT,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS prioridade TEXT,
ADD COLUMN IF NOT EXISTS nome_exame TEXT;