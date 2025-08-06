-- Limpar novamente a tabela precos_servicos para novo upload com mapeamento correto
TRUNCATE TABLE precos_servicos RESTART IDENTITY CASCADE;

-- Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('precos_servicos', 'DELETE', 'cleanup_before_correct_mapping', 
        jsonb_build_object('action', 'truncate_table_for_remapping', 'timestamp', now()),
        'system', 'info');