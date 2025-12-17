-- Limpar tipificação aplicada indevidamente no período 2025-10
-- Reseta os campos tipo_faturamento e tipo_cliente para NULL
UPDATE volumetria_mobilemed 
SET tipo_faturamento = NULL, tipo_cliente = NULL
WHERE periodo_referencia = '2025-10'
AND tipo_faturamento IS NOT NULL;