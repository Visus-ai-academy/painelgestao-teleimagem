-- Corrigir mapeamento para os 9 campos do arquivo Excel
DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes';

-- Inserir os 9 campos que existem no arquivo Excel baseado na estrutura da tabela clientes
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'nome', 'nome', 'clientes', 'text', true, 1, true),
('MobileMed - Clientes', 'clientes', 'email', 'email', 'clientes', 'text', false, 2, true),
('MobileMed - Clientes', 'clientes', 'cnpj', 'cnpj', 'clientes', 'text', false, 3, true),
('MobileMed - Clientes', 'clientes', 'endereco', 'endereco', 'clientes', 'text', false, 4, true),
('MobileMed - Clientes', 'clientes', 'contato', 'contato', 'clientes', 'text', false, 5, true),
('MobileMed - Clientes', 'clientes', 'cod_cliente', 'cod_cliente', 'clientes', 'text', false, 6, true),
('MobileMed - Clientes', 'clientes', 'data_inicio_contrato', 'data_inicio_contrato', 'clientes', 'date', false, 7, true),
('MobileMed - Clientes', 'clientes', 'data_termino_vigencia', 'data_termino_vigencia', 'clientes', 'date', false, 8, true),
('MobileMed - Clientes', 'clientes', 'ativo', 'ativo', 'clientes', 'boolean', false, 9, true);