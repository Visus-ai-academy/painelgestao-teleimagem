-- Desabilitar temporariamente o trigger de processamento para acelerar uploads
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- Comentar a criação do trigger para não aplicar regras durante insert
-- O processamento será feito via edge functions após o upload
-- CREATE TRIGGER trigger_volumetria_processamento
--   BEFORE INSERT ON volumetria_mobilemed
--   FOR EACH ROW 
--   EXECUTE FUNCTION trigger_volumetria_processamento();