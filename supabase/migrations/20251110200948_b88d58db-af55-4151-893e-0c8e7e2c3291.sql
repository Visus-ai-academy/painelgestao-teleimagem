-- Adicionar constraint única na tabela demonstrativos_faturamento_calculados
-- para permitir o upsert por cliente_nome e periodo_referencia

-- Primeiro, remover registros duplicados se existirem
DELETE FROM demonstrativos_faturamento_calculados a
USING demonstrativos_faturamento_calculados b
WHERE a.id < b.id
  AND a.cliente_nome = b.cliente_nome
  AND a.periodo_referencia = b.periodo_referencia;

-- Criar constraint única
ALTER TABLE demonstrativos_faturamento_calculados
ADD CONSTRAINT demonstrativos_faturamento_calculados_cliente_periodo_key 
UNIQUE (cliente_nome, periodo_referencia);

-- Comentário para documentar
COMMENT ON CONSTRAINT demonstrativos_faturamento_calculados_cliente_periodo_key 
ON demonstrativos_faturamento_calculados 
IS 'Garante que não existam demonstrativos duplicados para o mesmo cliente e período';