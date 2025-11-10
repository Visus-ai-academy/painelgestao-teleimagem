-- Limpar demonstrativos órfãos do período 2025-06
-- Estes demonstrativos não possuem volumetria correspondente no banco

DELETE FROM demonstrativos_faturamento_calculados
WHERE periodo_referencia = '2025-06';