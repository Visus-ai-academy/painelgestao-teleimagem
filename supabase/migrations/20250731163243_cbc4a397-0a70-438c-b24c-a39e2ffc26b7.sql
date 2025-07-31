-- Marcar upload atual como erro devido a timeout
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"erro": "Edge function timeout - processamento travado", "timestamp": "' || NOW()::text || '"}'::jsonb,
    completed_at = NOW()
WHERE id = 'a3ebc539-a6b8-42fa-8255-73a4f03de71a' 
AND status = 'processando';