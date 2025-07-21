-- Atualizar template de clientes para corresponder ao formato correto do CSV
UPDATE import_templates 
SET auto_detect_columns = '["nome", "email", "cnpj"]'
WHERE name = 'MobileMed - Clientes' AND file_type = 'clientes';

-- Atualizar mapeamentos de campos para corresponder ao template CSV
UPDATE field_mappings 
SET source_field = 'nome', target_field = 'nome'
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'Cliente (Nome Fantasia)';

UPDATE field_mappings 
SET source_field = 'email', target_field = 'email'
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'e-mail';

UPDATE field_mappings 
SET source_field = 'cnpj', target_field = 'cnpj'
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'CNPJ/CPF';

UPDATE field_mappings 
SET source_field = 'telefone', target_field = 'telefone'
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'contato';

UPDATE field_mappings 
SET source_field = 'endereco', target_field = 'endereco'
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'endereço';

-- Adicionar campo ativo que está no template CSV
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index)
VALUES ('MobileMed - Clientes', 'clientes', 'ativo', 'ativo', 'clientes', 'boolean', false, 7)
ON CONFLICT DO NOTHING;

-- Remover campo razão social que não está no template CSV
DELETE FROM field_mappings 
WHERE template_name = 'MobileMed - Clientes' AND source_field = 'Cliente (Razão Social)';