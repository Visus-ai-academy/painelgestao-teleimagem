-- Primeiro remover duplicatas baseadas em cliente_nome e periodo
DELETE FROM relatorios_faturamento_status a
USING relatorios_faturamento_status b
WHERE a.id < b.id 
  AND a.cliente_nome = b.cliente_nome 
  AND a.periodo = b.periodo;

-- Criar índice único para cliente_nome + periodo (necessário para upsert funcionar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorios_faturamento_status_cliente_nome_periodo 
ON relatorios_faturamento_status(cliente_nome, periodo);