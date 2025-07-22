-- Cancelar processo atual travado
UPDATE upload_logs 
SET status = 'error', 
    error_message = 'Processo cancelado - implementando solução para arquivos grandes',
    updated_at = now()
WHERE id = '4e137a94-e89b-450a-98fc-d794bb00e2ef' 
AND status = 'processing';