-- Adicionar coluna para registros ignorados na tabela processamento_uploads
ALTER TABLE processamento_uploads 
ADD COLUMN IF NOT EXISTS registros_ignorados INTEGER DEFAULT 0;