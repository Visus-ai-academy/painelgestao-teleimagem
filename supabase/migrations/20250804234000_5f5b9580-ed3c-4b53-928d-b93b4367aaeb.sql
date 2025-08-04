-- Limpar todos os contratos existentes para recriar com base em CNPJs únicos
DELETE FROM contratos_clientes;

-- Reiniciar a sequência de IDs se necessário
-- Como usamos UUID, não há sequência, mas vamos adicionar um log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('contratos_clientes', 'DELETE', 'bulk_cleanup', 
        jsonb_build_object('acao', 'Limpeza completa para recriar por CNPJs únicos', 'timestamp', now()),
        COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');