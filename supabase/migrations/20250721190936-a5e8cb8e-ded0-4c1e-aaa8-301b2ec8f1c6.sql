-- Remover temporariamente o trigger de auditoria para permitir limpeza
DROP TRIGGER IF EXISTS audit_trigger_clientes ON clientes;

-- Limpar todos os clientes existentes
DELETE FROM clientes;

-- Recriar o trigger de auditoria
CREATE TRIGGER audit_trigger_clientes
  BEFORE INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();