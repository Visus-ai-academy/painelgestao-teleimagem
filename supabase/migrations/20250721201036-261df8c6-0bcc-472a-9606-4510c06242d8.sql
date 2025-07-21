-- Limpar mapeamentos antigos e inserir apenas os que correspondem ao template atual
DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes';

-- Inserir mapeamentos corretos para o template atual (6 campos)
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'nome', 'nome', 'clientes', 'text', true, 1, true),
('MobileMed - Clientes', 'clientes', 'email', 'email', 'clientes', 'text', false, 2, true),
('MobileMed - Clientes', 'clientes', 'telefone', 'telefone', 'clientes', 'text', false, 3, true),
('MobileMed - Clientes', 'clientes', 'endereco', 'endereco', 'clientes', 'text', false, 4, true),
('MobileMed - Clientes', 'clientes', 'cnpj', 'cnpj', 'clientes', 'text', false, 5, true),
('MobileMed - Clientes', 'clientes', 'ativo', 'ativo', 'clientes', 'boolean', false, 6, true);