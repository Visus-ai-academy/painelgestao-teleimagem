-- Primeiro limpar tabelas que referenciam clientes
DELETE FROM contratos_clientes;
DELETE FROM parametros_faturamento;
DELETE FROM precos_servicos;

-- Agora limpar a tabela clientes
DELETE FROM clientes;