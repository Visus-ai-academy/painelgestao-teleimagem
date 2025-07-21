-- Primeiro vamos limpar os dados incorretos dos clientes
DELETE FROM clientes WHERE created_at > NOW() - INTERVAL '2 hours';

-- Vamos verificar se precisa adicionar uma coluna status na tabela clientes
-- Verifica se existe e se não é do tipo correto
DO $$
BEGIN
    -- Adiciona a coluna status se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE clientes ADD COLUMN status text DEFAULT 'Ativo';
    END IF;
END $$;

-- Atualiza os status baseado no campo ativo
UPDATE clientes SET status = CASE 
    WHEN ativo = true THEN 'Ativo'
    WHEN ativo = false THEN 'Inativo'
    ELSE 'Ativo'
END;

-- Garante que o status não pode ser nulo
ALTER TABLE clientes ALTER COLUMN status SET NOT NULL;

-- Adiciona constraint para validar os valores de status
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS chk_clientes_status;
ALTER TABLE clientes ADD CONSTRAINT chk_clientes_status 
    CHECK (status IN ('Ativo', 'Inativo'));