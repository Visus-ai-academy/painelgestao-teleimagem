-- Habilitar real-time para a tabela volumetria_mobilemed
ALTER TABLE public.volumetria_mobilemed REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.volumetria_mobilemed;