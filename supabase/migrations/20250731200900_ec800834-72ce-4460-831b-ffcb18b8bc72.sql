-- Atualizar status de todos os clientes para 'Ativo'
UPDATE clientes SET status = 'Ativo' WHERE status = 'Inativo';