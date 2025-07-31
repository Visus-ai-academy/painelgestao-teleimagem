-- Marcar upload atual como erro para permitir novo upload
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload cancelado - função otimizada', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE id = '828bbee0-caa2-43be-b3c5-8dfbf211175d' 
AND status = 'processando';