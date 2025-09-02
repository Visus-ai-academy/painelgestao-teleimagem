-- Reabilitar triggers desabilitados que aplicam regras na volumetria_mobilemed
ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_aplicar_regras_completas;
ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_regras_basicas;

-- Verificar se o trigger de auto aplicar regras está ativo
ALTER TABLE processamento_uploads ENABLE TRIGGER auto_aplicar_regras_trigger;