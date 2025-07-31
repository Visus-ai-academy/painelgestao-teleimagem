-- Corrigir upload travado
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"erro": "Processamento travado - timeout da edge function", "timestamp": "2025-07-31T16:30:00Z"}'::jsonb,
    completed_at = now()
WHERE id = 'f5330e09-b86d-40bf-a87b-de6f0f746ffe' 
AND status = 'processando';