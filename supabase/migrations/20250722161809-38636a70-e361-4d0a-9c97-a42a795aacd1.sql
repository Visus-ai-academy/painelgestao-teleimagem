-- Cancelar processo travado e implementar timeout
UPDATE upload_logs 
SET status = 'error', 
    error_message = 'Processo cancelado por timeout - edge function travada',
    updated_at = now()
WHERE id = '8a83d37d-7880-4f85-aa55-7611db6ce560' 
AND status = 'processing';