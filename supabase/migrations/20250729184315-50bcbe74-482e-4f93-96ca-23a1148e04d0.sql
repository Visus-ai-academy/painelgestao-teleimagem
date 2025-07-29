-- Limpar completamente a tabela modalidades
DELETE FROM modalidades;

-- Resetar a sequência se necessário
ALTER SEQUENCE IF EXISTS modalidades_ordem_seq RESTART WITH 1;