-- Correção mais simples - apenas recriar o trigger sem o log
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

CREATE TRIGGER trigger_volumetria_processamento_completo
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_volumetria_processamento_completo();