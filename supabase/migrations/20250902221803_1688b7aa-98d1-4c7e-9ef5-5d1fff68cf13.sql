-- Finalizar uploads travados
UPDATE processamento_uploads 
SET status = 'concluido',
    finalizado_em = now(),
    updated_at = now()
WHERE status = 'processando' 
AND created_at > now() - interval '4 hours';