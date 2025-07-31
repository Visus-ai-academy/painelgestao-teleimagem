-- LIMPEZA ESPECÍFICA - APENAS VOLUMETRIA PADRÃO
-- Remove apenas os registros do arquivo volumetria padrão

-- 1. Deletar registros específicos da volumetria padrão
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao';

-- 2. Limpar status de processamento específico da volumetria padrão
DELETE FROM processamento_uploads 
WHERE tipo_arquivo = 'volumetria_padrao';

-- 3. Limpar histórico específico da volumetria padrão (se existir)
DELETE FROM import_history 
WHERE file_type = 'volumetria_padrao';

-- Log da operação específica
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_padrao_limpeza', 'DELETE', 'cleanup_volumetria_padrao', 
        jsonb_build_object(
          'arquivo_fonte', 'volumetria_padrao',
          'data_limpeza', now(),
          'motivo', 'Limpeza específica do arquivo volumetria padrão'
        ),
        'system', 'info');