-- Corrigir todos os mapeamentos para a tabela clientes conforme o template atualizado
UPDATE field_mappings 
SET source_field = 'Status'
WHERE file_type = 'clientes' 
AND target_field = 'ativo' 
AND template_name = 'MobileMed - Clientes';

-- Verificar se existem todos os mapeamentos necessários, se não existem, criar
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'Contagem de Cliente (Nome Fantasia)', 'nome', 'clientes', 'text', true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'nome'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'email', 'email', 'clientes', 'text', false, 2, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'email'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'cnpj', 'cnpj', 'clientes', 'text', false, 3, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'cnpj'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'contato', 'contato', 'clientes', 'text', false, 4, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'contato'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'endereço', 'endereco', 'clientes', 'text', false, 5, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'endereco'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'Status', 'Status', 'clientes', 'text', false, 6, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'Status'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'data inicio contrato', 'data_inicio_contrato', 'clientes', 'date', false, 7, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'data_inicio_contrato'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'data termino de vigência', 'data_termino_vigencia', 'clientes', 'date', false, 8, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'data_termino_vigencia'
);

INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active)
SELECT 'MobileMed - Clientes', 'clientes', 'cod cliente', 'cod_cliente', 'clientes', 'text', false, 9, true
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' AND file_type = 'clientes' AND target_field = 'cod_cliente'
);