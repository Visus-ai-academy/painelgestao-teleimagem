-- DESABILITAR TEMPORARIAMENTE OS TRIGGERS QUE APLICAM REGRAS DE EXCLUSÃO
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_processamento_automatico_volumetria;
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER set_data_referencia_trigger; 
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_data_referencia;