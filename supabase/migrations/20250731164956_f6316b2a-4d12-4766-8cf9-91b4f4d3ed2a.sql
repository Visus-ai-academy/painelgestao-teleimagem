-- Cancelar todos os uploads travados
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload cancelado - sistema otimizado', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE status = 'processando';

-- Verificar se a tabela volumetria_mobilemed existe e tem a estrutura correta
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'volumetria_mobilemed' 
ORDER BY ordinal_position;