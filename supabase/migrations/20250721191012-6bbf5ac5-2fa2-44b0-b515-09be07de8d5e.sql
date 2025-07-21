-- Remover completamente os triggers de auditoria da tabela clientes
DROP TRIGGER IF EXISTS audit_trigger_clientes ON clientes;

-- Usar uma abordagem mais direta para limpeza
TRUNCATE TABLE clientes RESTART IDENTITY CASCADE;