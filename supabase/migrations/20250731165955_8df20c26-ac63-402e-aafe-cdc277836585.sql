-- Cancelar o upload travado
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload travado - cancelado automaticamente', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE id = '0c0fbd93-b26a-449c-9509-1a98e23a3284' AND status = 'processando';