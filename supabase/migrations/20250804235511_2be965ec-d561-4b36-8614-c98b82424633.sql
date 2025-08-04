-- Verificar se a coluna file_size existe na tabela upload_logs
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'upload_logs';

-- Adicionar colunas necessárias se não existirem
ALTER TABLE public.upload_logs 
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS uploader text;