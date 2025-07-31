-- Limpar todos os uploads travados no processamento
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload cancelado - limpeza de uploads travados', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE status = 'processando';