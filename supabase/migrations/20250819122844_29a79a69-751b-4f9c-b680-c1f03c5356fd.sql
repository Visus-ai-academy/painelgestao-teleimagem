-- Configurar realtime para monitoramento de uploads e staging
ALTER TABLE volumetria_staging REPLICA IDENTITY FULL;
ALTER TABLE processamento_uploads REPLICA IDENTITY FULL;
ALTER TABLE volumetria_mobilemed REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE volumetria_staging;
ALTER PUBLICATION supabase_realtime ADD TABLE processamento_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE volumetria_mobilemed;