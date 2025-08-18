-- Ativar o trigger automático na tabela volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_aplicar_regras_automaticas ON volumetria_mobilemed;

CREATE TRIGGER trigger_aplicar_regras_automaticas
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_automaticas_volumetria();