-- Limpar dados incorretos de clientes inseridos hoje
DELETE FROM clientes WHERE created_at >= '2025-07-21 00:00:00';