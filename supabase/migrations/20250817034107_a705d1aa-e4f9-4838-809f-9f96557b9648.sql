-- Atualizar mapeamentos existentes e adicionar novos campos para clientes
-- Atualizar campo Nome_Fantasia para mapear corretamente
UPDATE field_mappings 
SET target_field = 'nome_fantasia' 
WHERE source_field = 'Nome_Fantasia' AND file_type = 'clientes';

-- Atualizar campo TIPO para TIPO_CLIENTE
UPDATE field_mappings 
SET source_field = 'TIPO_CLIENTE' 
WHERE source_field = 'TIPO' AND file_type = 'clientes';

-- Inserir campos que estão faltando
INSERT INTO field_mappings (template_name, file_type, source_field, target_table, target_field, field_type, is_required, order_index, active)
VALUES 
  ('MobileMed - Clientes', 'clientes', 'Razão Social', 'clientes', 'razao_social', 'text', false, 9, true),
  ('MobileMed - Clientes', 'clientes', 'Bairro', 'clientes', 'bairro', 'text', false, 10, true),
  ('MobileMed - Clientes', 'clientes', 'CEP', 'clientes', 'cep', 'text', false, 11, true),
  ('MobileMed - Clientes', 'clientes', 'E-MAIL', 'clientes', 'email_envio_nf', 'text', false, 12, true)
ON CONFLICT (template_name, file_type, source_field) DO UPDATE SET
  target_field = EXCLUDED.target_field,
  order_index = EXCLUDED.order_index,
  active = EXCLUDED.active;