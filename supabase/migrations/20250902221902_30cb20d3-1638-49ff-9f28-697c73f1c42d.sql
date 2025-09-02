-- Finalizar uploads travados
UPDATE processamento_uploads 
SET status = 'concluido',
    completed_at = now()
WHERE status = 'processando' 
AND created_at > now() - interval '4 hours';