-- Cancelar upload travado atual
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload travado - timeout durante validação', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE id = '7cdc7c5a-dd7a-4e73-a72a-89383bf7c57b' 
  AND status = 'processando';