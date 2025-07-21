-- Adicionar mapeamentos de campos faltantes para clientes
INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'e-mail', 'email', 'clientes', 'text', false, 2, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'telefone', 'telefone', 'clientes', 'text', false, 3, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'endereco', 'endereco', 'clientes', 'text', false, 4, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'contato', 'contato', 'clientes', 'text', false, 5, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'cod cliente', 'cod_cliente', 'clientes', 'text', false, 6, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'data inicio contrato', 'data_inicio_contrato', 'clientes', 'date', false, 7, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'data termino de vigência', 'data_termino_vigencia', 'clientes', 'date', false, 8, true);

INSERT INTO public.field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'Status', 'Status', 'clientes', 'text', false, 9, true);