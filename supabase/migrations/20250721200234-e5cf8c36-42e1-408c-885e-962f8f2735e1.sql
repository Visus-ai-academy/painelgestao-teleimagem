-- Adicionar mapeamentos de campos faltantes para clientes
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'e-mail', 'email', 'clientes', 'text', false, 2, true),
('MobileMed - Clientes', 'clientes', 'telefone', 'telefone', 'clientes', 'text', false, 3, true),
('MobileMed - Clientes', 'clientes', 'endereco', 'endereco', 'clientes', 'text', false, 4, true),
('MobileMed - Clientes', 'clientes', 'contato', 'contato', 'clientes', 'text', false, 5, true),
('MobileMed - Clientes', 'clientes', 'cod cliente', 'cod_cliente', 'clientes', 'text', false, 6, true),
('MobileMed - Clientes', 'clientes', 'data inicio contrato', 'data_inicio_contrato', 'clientes', 'date', false, 7, true),
('MobileMed - Clientes', 'clientes', 'data termino de vigência', 'data_termino_vigencia', 'clientes', 'date', false, 8, true),
('MobileMed - Clientes', 'clientes', 'Status', 'Status', 'clientes', 'text', false, 9, true)
ON CONFLICT (template_name, file_type, source_field) DO UPDATE SET 
target_field = EXCLUDED.target_field,
active = EXCLUDED.active;