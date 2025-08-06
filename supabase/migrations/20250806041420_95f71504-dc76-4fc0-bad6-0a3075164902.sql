-- Atualizar status do upload que falhou por falta de recursos
UPDATE upload_logs 
SET status = 'failed',
    error_message = 'Edge Function falhou por falta de recursos computacionais (erro 546) - 17.200 registros foram inseridos',
    updated_at = now()
WHERE created_at >= '2025-08-06 04:12:00' 
  AND status = 'processing';