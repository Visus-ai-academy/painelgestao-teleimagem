-- Remover todos os triggers primeiro
DROP TRIGGER IF EXISTS trigger_sync_field_mappings ON field_mappings;
DROP TRIGGER IF EXISTS sync_field_mappings_trigger ON field_mappings;

-- Agora remover a função
DROP FUNCTION IF EXISTS public.sync_field_mappings() CASCADE;

-- Fazer as atualizações
DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes';

UPDATE import_templates 
SET auto_detect_columns = '["NOME_MOBILEMED", "CNPJ", "E-MAIL ENVIO NF"]'::jsonb
WHERE file_type = 'clientes' AND name = 'MobileMed - Clientes';

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
VALUES 
  ('MobileMed - Clientes', 'clientes', 'NOME_MOBILEMED', 'nome', 'clientes', 'text', true, 1, true),
  ('MobileMed - Clientes', 'clientes', 'Nome_Fantasia', 'contato', 'clientes', 'text', false, 2, true),
  ('MobileMed - Clientes', 'clientes', 'CNPJ', 'cnpj', 'clientes', 'text', false, 3, true),
  ('MobileMed - Clientes', 'clientes', 'Endereço', 'endereco', 'clientes', 'text', false, 5, true),
  ('MobileMed - Clientes', 'clientes', 'Cidade', 'cidade', 'clientes', 'text', false, 6, true),
  ('MobileMed - Clientes', 'clientes', 'UF', 'estado', 'clientes', 'text', false, 7, true),
  ('MobileMed - Clientes', 'clientes', 'E-MAIL ENVIO NF', 'email', 'clientes', 'text', false, 8, true);