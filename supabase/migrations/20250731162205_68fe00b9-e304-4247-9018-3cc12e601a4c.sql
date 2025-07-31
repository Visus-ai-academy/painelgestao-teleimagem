-- Verificar e ajustar a tabela processamento_uploads
-- Primeiro, vamos verificar a estrutura atual
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'processamento_uploads' 
AND column_name = 'tipo_dados';

-- Se a coluna não existe ou tem problema, vamos garantir que existe corretamente
DO $$
BEGIN
    -- Verificar se a coluna existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processamento_uploads' 
        AND column_name = 'tipo_dados'
    ) THEN
        -- Adicionar a coluna se não existe
        ALTER TABLE processamento_uploads 
        ADD COLUMN tipo_dados TEXT NOT NULL DEFAULT 'volumetria';
    ELSE
        -- Se existe, garantir que tem valor padrão
        ALTER TABLE processamento_uploads 
        ALTER COLUMN tipo_dados SET DEFAULT 'volumetria';
        
        -- Atualizar registros existentes com valor null
        UPDATE processamento_uploads 
        SET tipo_dados = 'volumetria' 
        WHERE tipo_dados IS NULL;
    END IF;
END $$;