-- Corrigir status dos clientes para 'Ativo' quando ativo = true
UPDATE clientes 
SET status = 'Ativo', 
    updated_at = now()
WHERE ativo = true 
  AND status != 'Ativo';