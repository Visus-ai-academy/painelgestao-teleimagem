-- Cancelar upload travado atual
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload cancelado - função otimizada', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE id = 'b075f8df-7ffd-44b4-8589-c5180499870e' 
  AND status = 'processando';