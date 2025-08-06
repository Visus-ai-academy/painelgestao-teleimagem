-- Desabilitar trigger temporariamente
ALTER TABLE precos_servicos DISABLE TRIGGER ALL;

-- Limpar todos os preços
DELETE FROM precos_servicos;

-- Reabilitar trigger
ALTER TABLE precos_servicos ENABLE TRIGGER ALL;

-- Atualizar manualmente os status dos contratos
UPDATE contratos_clientes SET tem_precos_configurados = false;