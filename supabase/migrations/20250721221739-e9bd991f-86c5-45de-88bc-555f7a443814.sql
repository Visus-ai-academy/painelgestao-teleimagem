-- Corrigir mapeamentos baseado nos cabeçalhos reais detectados nos logs
-- Os cabeçalhos reais são: "cliente", "cnpj", "email", "contato", "endereço", "Status", "data inicio contrato", "data termino de vigência", "cod cliente"

DELETE FROM field_mappings WHERE template_name = 'MobileMed - Clientes';

-- Inserir mapeamentos corretos baseado nos dados reais do arquivo
INSERT INTO field_mappings (template_name, file_type, source_field, target_field, target_table, field_type, is_required, order_index, active) VALUES
('MobileMed - Clientes', 'clientes', 'cliente', 'nome', 'clientes', 'text', true, 1, true),
('MobileMed - Clientes', 'clientes', 'cnpj', 'cnpj', 'clientes', 'text', false, 2, true),
('MobileMed - Clientes', 'clientes', 'email', 'email', 'clientes', 'text', false, 3, true),
('MobileMed - Clientes', 'clientes', 'contato', 'telefone', 'clientes', 'text', false, 4, true),
('MobileMed - Clientes', 'clientes', 'endereço', 'endereco', 'clientes', 'text', false, 5, true),
('MobileMed - Clientes', 'clientes', 'data inicio contrato', 'data_inicio_contrato', 'clientes', 'date', false, 6, true),
('MobileMed - Clientes', 'clientes', 'data termino de vigência', 'data_termino_vigencia', 'clientes', 'date', false, 7, true),
('MobileMed - Clientes', 'clientes', 'cod cliente', 'cod_cliente', 'clientes', 'text', false, 8, true);

-- Atualizar template para detectar colunas corretas
UPDATE import_templates 
SET auto_detect_columns = '["cliente", "cnpj", "email"]'
WHERE name = 'MobileMed - Clientes' AND file_type = 'clientes';