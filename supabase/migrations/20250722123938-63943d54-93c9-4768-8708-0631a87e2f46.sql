-- Excluir o upload travado no status 'processing' desde 03:01h
DELETE FROM upload_logs 
WHERE filename = 'faturamento_1753153300227_faturamento.xlsx' 
  AND status = 'processing' 
  AND created_at = '2025-07-22 03:01:31.925069+00';