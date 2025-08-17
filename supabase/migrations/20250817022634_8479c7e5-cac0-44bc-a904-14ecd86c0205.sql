-- Adicionar campos necessários na tabela volumetria_mobilemed se não existirem
DO $$
BEGIN
  -- Adicionar campo cliente_nome_fantasia se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'volumetria_mobilemed' 
    AND column_name = 'cliente_nome_fantasia'
  ) THEN
    ALTER TABLE volumetria_mobilemed ADD COLUMN cliente_nome_fantasia TEXT;
  END IF;
  
  -- Adicionar campo tipo_cliente se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'volumetria_mobilemed' 
    AND column_name = 'tipo_cliente'
  ) THEN
    ALTER TABLE volumetria_mobilemed ADD COLUMN tipo_cliente TEXT DEFAULT 'CO';
  END IF;
  
  -- Verificar se já existe e se não, adicionar campo tipo_faturamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'volumetria_mobilemed' 
    AND column_name = 'tipo_faturamento'
  ) THEN
    ALTER TABLE volumetria_mobilemed ADD COLUMN tipo_faturamento TEXT DEFAULT 'CO-FT';
  END IF;
END $$;