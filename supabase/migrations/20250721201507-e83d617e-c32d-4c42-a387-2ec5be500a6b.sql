-- Restaurar todos os 10 campos originais do mapeamento de clientes
DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes';

-- Inserir os 10 campos completos
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'Cliente (Nome Fantasia)', 'nome', 'clientes', 'text', true, 1, true),
('MobileMed - Clientes', 'clientes', 'CNPJ/CPF', 'cnpj', 'clientes', 'text', true, 2, true),
('MobileMed - Clientes', 'clientes', 'e-mail', 'email', 'clientes', 'text', false, 3, true),
('MobileMed - Clientes', 'clientes', 'telefone', 'telefone', 'clientes', 'text', false, 4, true),
('MobileMed - Clientes', 'clientes', 'endereco', 'endereco', 'clientes', 'text', false, 5, true),
('MobileMed - Clientes', 'clientes', 'contato', 'contato', 'clientes', 'text', false, 6, true),
('MobileMed - Clientes', 'clientes', 'cod cliente', 'cod_cliente', 'clientes', 'text', false, 7, true),
('MobileMed - Clientes', 'clientes', 'data inicio contrato', 'data_inicio_contrato', 'clientes', 'date', false, 8, true),
('MobileMed - Clientes', 'clientes', 'data termino de vigência', 'data_termino_vigencia', 'clientes', 'date', false, 9, true),
('MobileMed - Clientes', 'clientes', 'Status', 'status', 'clientes', 'text', false, 10, true);