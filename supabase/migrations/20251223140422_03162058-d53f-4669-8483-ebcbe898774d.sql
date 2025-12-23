-- Finalizar jobs travados há mais de 10 minutos
UPDATE processamento_regras_log 
SET status = 'concluido',
    completed_at = now(),
    mensagem = 'Finalizado manualmente (timeout detectado)'
WHERE status = 'processando' 
AND started_at < now() - interval '10 minutes'