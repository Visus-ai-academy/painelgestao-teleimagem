-- Limpar completamente a tabela precos_servicos para novo upload
TRUNCATE TABLE precos_servicos RESTART IDENTITY CASCADE;

-- Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('precos_servicos', 'DELETE', 'full_cleanup', 
        jsonb_build_object('action', 'truncate_table', 'timestamp', now()),
        'system', 'info');