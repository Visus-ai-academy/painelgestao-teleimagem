-- Limpar uploads travados em status processing
UPDATE upload_logs 
SET status = 'failed',
    error_message = 'Upload travado - limpeza manual após análise',
    updated_at = now()
WHERE status = 'processing' 
  AND created_at < now() - INTERVAL '10 minutes';