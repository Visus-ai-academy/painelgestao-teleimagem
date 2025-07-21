-- Atualizar o campo status para todos os clientes existentes baseado no campo ativo
UPDATE clientes 
SET status = CASE 
    WHEN ativo = true THEN 'Ativo'
    WHEN ativo = false THEN 'Inativo'
    ELSE 'Ativo'
END
WHERE status IS NULL OR status = '';