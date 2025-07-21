-- Ajustar mapeamento de clientes baseado no arquivo real sendo enviado
DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes';

-- Inserir apenas os campos que realmente existem no arquivo Excel
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'Contagem de Cliente (Nome Fantasia)', 'nome', 'clientes', 'text', true, 1, true);