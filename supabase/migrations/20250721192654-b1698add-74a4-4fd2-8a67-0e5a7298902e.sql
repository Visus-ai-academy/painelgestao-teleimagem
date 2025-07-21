-- Remover todos os triggers de auditoria da tabela clientes
DROP TRIGGER IF EXISTS audit_clientes ON clientes;
DROP TRIGGER IF EXISTS audit_trigger_clientes ON clientes;