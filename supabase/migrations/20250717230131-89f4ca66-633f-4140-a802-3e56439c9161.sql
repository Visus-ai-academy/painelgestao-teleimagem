-- Limpar dados de faturamento incorretos para reprocessamento
DELETE FROM faturamento WHERE periodo = '2025-07';