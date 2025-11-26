-- Adicionar coluna tipo_cliente na tabela demonstrativos_faturamento_calculados
ALTER TABLE demonstrativos_faturamento_calculados 
ADD COLUMN IF NOT EXISTS tipo_cliente TEXT;

-- Adicionar coluna tipo_faturamento se não existir
ALTER TABLE demonstrativos_faturamento_calculados 
ADD COLUMN IF NOT EXISTS tipo_faturamento TEXT;

-- Atualizar tipo_cliente dos demonstrativos existentes baseado no cadastro de clientes
UPDATE demonstrativos_faturamento_calculados d
SET tipo_cliente = COALESCE(
  (SELECT c.tipo_cliente FROM clientes c WHERE c.id = d.cliente_id LIMIT 1),
  (SELECT cc.tipo_cliente FROM clientes c 
   JOIN contratos_clientes cc ON cc.cliente_id = c.id 
   WHERE c.id = d.cliente_id LIMIT 1),
  'CO'
)
WHERE tipo_cliente IS NULL;