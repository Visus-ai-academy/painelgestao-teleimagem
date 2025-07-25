-- Verificar e configurar realtime para tabela clientes
-- Adicionar à publicação de realtime se não estiver
DO $$
BEGIN
    -- Verificar se a tabela já está na publicação
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'clientes'
    ) THEN
        -- Adicionar tabela à publicação realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
    END IF;
END $$;

-- Configurar REPLICA IDENTITY FULL para capturar dados completos
ALTER TABLE clientes REPLICA IDENTITY FULL;