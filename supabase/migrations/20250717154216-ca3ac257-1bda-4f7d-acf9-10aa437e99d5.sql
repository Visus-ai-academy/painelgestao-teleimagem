-- Remover registros duplicados de clientes, mantendo apenas o mais recente
DELETE FROM clientes a 
USING clientes b 
WHERE a.created_at < b.created_at 
  AND a.nome = b.nome 
  AND a.email = b.email;

-- Criar índice único para evitar duplicações futuras
CREATE UNIQUE INDEX idx_clientes_nome_email 
ON clientes(nome, email) 
WHERE ativo = true AND email IS NOT NULL;