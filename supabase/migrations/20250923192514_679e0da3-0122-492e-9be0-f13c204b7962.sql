-- Corrigir tipo_faturamento na tabela faturamento que está NULL
-- Buscar do contrato_clientes para preencher os valores NULL

UPDATE faturamento f
SET tipo_faturamento = cc.tipo_faturamento
FROM clientes c
JOIN contratos_clientes cc ON cc.cliente_id = c.id
WHERE f.cliente_nome = c.nome
  AND f.tipo_faturamento IS NULL
  AND cc.status = 'ativo';