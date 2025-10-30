-- Remover coluna registros_ignorados da tabela processamento_uploads
ALTER TABLE processamento_uploads 
DROP COLUMN IF EXISTS registros_ignorados;