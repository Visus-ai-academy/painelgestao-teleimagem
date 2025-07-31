-- Limpar dados do arquivo "Volumetria Onco Padrão"
-- Primeiro vamos verificar quais arquivos_fonte existem para identificar o correto

SELECT DISTINCT arquivo_fonte, COUNT(*) as total_registros
FROM volumetria_mobilemed 
WHERE arquivo_fonte ILIKE '%onco%' OR arquivo_fonte ILIKE '%padrao%'
GROUP BY arquivo_fonte
ORDER BY arquivo_fonte;

-- Limpar especificamente dados de arquivos relacionados a ONCO
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte ILIKE '%onco%';

-- Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'DELETE', 'cleanup_onco', 
        jsonb_build_object('tipo_limpeza', 'onco_padrao', 'criterio', 'arquivo_fonte ILIKE onco'),
        'system', 'info');