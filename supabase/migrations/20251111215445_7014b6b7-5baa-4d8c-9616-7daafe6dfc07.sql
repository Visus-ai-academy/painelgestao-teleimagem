-- Adicionar campo cliente_nome na tabela precos_servicos para armazenar nome exato do arquivo Excel
ALTER TABLE precos_servicos
ADD COLUMN IF NOT EXISTS cliente_nome text;

-- Criar índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_precos_servicos_cliente_nome 
ON precos_servicos(cliente_nome);

-- Adicionar comentário explicativo
COMMENT ON COLUMN precos_servicos.cliente_nome IS 'Nome exato do cliente conforme arquivo Excel de upload, sem normalização. Usado para matching com nome_fantasia.';