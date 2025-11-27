-- Remove constraint UNIQUE de cliente_id para permitir múltiplos parâmetros por cliente
-- Isso permite cenários como: RMPADUA com 3 parâmetros, GOLD e GOLD_RMX compartilhando cliente_id
ALTER TABLE parametros_faturamento 
DROP CONSTRAINT IF EXISTS parametros_faturamento_cliente_id_key;