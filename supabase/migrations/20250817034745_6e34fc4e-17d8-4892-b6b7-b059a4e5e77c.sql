-- Limpar mapeamentos existentes de clientes para recriar na ordem correta
DELETE FROM field_mappings WHERE file_type = 'clientes' AND template_name = 'MobileMed - Clientes';

-- Inserir mapeamentos na ordem exata especificada pelo usuário
INSERT INTO field_mappings (template_name, file_type, source_field, target_table, target_field, field_type, is_required, order_index, active)
VALUES 
  ('MobileMed - Clientes', 'clientes', 'NOME_MOBILEMED', 'clientes', 'nome_mobilemed', 'text', true, 1, true),
  ('MobileMed - Clientes', 'clientes', 'Nome_Fantasia', 'clientes', 'nome_fantasia', 'text', false, 2, true),
  ('MobileMed - Clientes', 'clientes', 'CNPJ', 'clientes', 'cnpj', 'text', false, 3, true),
  ('MobileMed - Clientes', 'clientes', 'Razão Social', 'clientes', 'razao_social', 'text', false, 4, true),
  ('MobileMed - Clientes', 'clientes', 'Endereço', 'clientes', 'endereco', 'text', false, 5, true),
  ('MobileMed - Clientes', 'clientes', 'Bairro', 'clientes', 'bairro', 'text', false, 6, true),
  ('MobileMed - Clientes', 'clientes', 'CEP', 'clientes', 'cep', 'text', false, 7, true),
  ('MobileMed - Clientes', 'clientes', 'Cidade', 'clientes', 'cidade', 'text', false, 8, true),
  ('MobileMed - Clientes', 'clientes', 'UF', 'clientes', 'estado', 'text', false, 9, true),
  ('MobileMed - Clientes', 'clientes', 'E-MAIL', 'clientes', 'email', 'text', false, 10, true),
  ('MobileMed - Clientes', 'clientes', 'ENVIO NF', 'clientes', 'email_envio_nf', 'text', false, 11, true),
  ('MobileMed - Clientes', 'clientes', 'TIPO_CLIENTE', 'clientes', 'tipo_cliente', 'text', false, 12, true);