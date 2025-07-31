-- Atualizar template de clientes para detectar os cabeçalhos corretos
UPDATE import_templates 
SET auto_detect_columns = '["NOME_MOBILEMED", "CNPJ", "E-MAIL ENVIO NF"]'::jsonb
WHERE file_type = 'clientes' AND name = 'MobileMed - Clientes';

-- Adicionar novos mapeamentos de campos para corresponder aos cabeçalhos reais
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
VALUES 
  ('MobileMed - Clientes', 'clientes', 'NOME_MOBILEMED', 'nome', 'clientes', 'text', true, 1, true),
  ('MobileMed - Clientes', 'clientes', 'Nome_Fantasia', 'contato', 'clientes', 'text', false, 2, true),
  ('MobileMed - Clientes', 'clientes', 'CNPJ', 'cnpj', 'clientes', 'text', false, 3, true),
  ('MobileMed - Clientes', 'clientes', 'Razão Social', 'nome', 'clientes', 'text', false, 4, true),
  ('MobileMed - Clientes', 'clientes', 'Endereço', 'endereco', 'clientes', 'text', false, 5, true),
  ('MobileMed - Clientes', 'clientes', 'Cidade', 'cidade', 'clientes', 'text', false, 6, true),
  ('MobileMed - Clientes', 'clientes', 'UF', 'estado', 'clientes', 'text', false, 7, true),
  ('MobileMed - Clientes', 'clientes', 'E-MAIL ENVIO NF', 'email', 'clientes', 'text', false, 8, true)
ON CONFLICT (template_name, source_field) DO UPDATE SET
  target_field = EXCLUDED.target_field,
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;