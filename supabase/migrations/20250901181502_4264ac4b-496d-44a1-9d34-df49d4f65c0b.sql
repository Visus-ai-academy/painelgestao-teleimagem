-- CORRIGIR PROBLEMAS DE COLUNAS AUSENTES

-- 1. Adicionar coluna evento_tipo na tabela audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS evento_tipo TEXT;

-- 2. Verificar se coluna updated_at existe em processamento_uploads
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'processamento_uploads' AND column_name = 'updated_at';

-- 3. Parar upload atual travado (usando apenas colunas que existem)
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"erro":"Corrigido problema audit_logs - pode fazer novo upload"}'
WHERE id = '77eddda8-13fb-44e0-a7c5-5f9f5ae4faf0' 
  AND status = 'processando';

-- 4. Limpar registros órfãos do lote travado
DELETE FROM volumetria_mobilemed 
WHERE lote_upload = 'volumetria_padrao_1756750012204_77eddda8';

-- 5. Limpar registros rejeitados relacionados ao lote
DELETE FROM registros_rejeitados_processamento
WHERE lote_upload = 'volumetria_padrao_1756750012204_77eddda8';