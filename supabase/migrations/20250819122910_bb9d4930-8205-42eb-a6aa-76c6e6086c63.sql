-- Configurar realtime para monitoramento de uploads e staging
ALTER TABLE volumetria_staging REPLICA IDENTITY FULL;
ALTER TABLE processamento_uploads REPLICA IDENTITY FULL;

-- Adicionar apenas as tabelas que não estão na publicação
ALTER PUBLICATION supabase_realtime ADD TABLE volumetria_staging;
ALTER PUBLICATION supabase_realtime ADD TABLE processamento_uploads;