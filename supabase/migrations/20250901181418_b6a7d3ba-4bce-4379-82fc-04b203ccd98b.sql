-- CORRIGIR PROBLEMA DA COLUNA evento_tipo que está causando todos os erros

-- 1. Verificar se a coluna existe
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'audit_logs' AND column_name = 'evento_tipo';

-- 2. Adicionar a coluna se não existir
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS evento_tipo TEXT;

-- 3. Parar upload atual travado (marcar como erro para permitir novo upload)
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"erro":"Corrigido problema audit_logs - pode fazer novo upload"}',
    updated_at = now()
WHERE id = '77eddda8-13fb-44e0-a7c5-5f9f5ae4faf0' 
  AND status = 'processando';

-- 4. Limpar registros órfãos do lote travado
DELETE FROM volumetria_mobilemed 
WHERE lote_upload = 'volumetria_padrao_1756750012204_77eddda8';

-- 5. Verificar se ainda há triggers problemáticos ativos
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'volumetria_mobilemed' 
  AND trigger_name LIKE '%audit%';