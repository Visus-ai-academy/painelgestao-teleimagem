-- Executar quebra de exames para o arquivo_fonte específico que está sendo usado no comparativo
SELECT aplicar_regras_quebra_exames('volumetria_padrao');

-- Log para verificar a execução
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'QUEBRA_EXAMES_MANUAL', 'volumetria_padrao', 
        jsonb_build_object('timestamp', now(), 'acao', 'aplicar_quebra_manual'),
        'system', 'info');