-- Add missing detalhes_processamento column to volumetria_staging table
ALTER TABLE volumetria_staging 
ADD COLUMN IF NOT EXISTS detalhes_processamento JSONB DEFAULT NULL;