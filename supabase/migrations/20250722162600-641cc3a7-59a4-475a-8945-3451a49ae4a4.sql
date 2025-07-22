-- Cancelar processo atual
UPDATE upload_logs 
SET status = 'error', 
    error_message = 'Processo cancelado - implementando processamento síncrono',
    updated_at = now()
WHERE id = '56c1af86-b80b-4a56-a7cb-89774bd4504f' 
AND status = 'processing';