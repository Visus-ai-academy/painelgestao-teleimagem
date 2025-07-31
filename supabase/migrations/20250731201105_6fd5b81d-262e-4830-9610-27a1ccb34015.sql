-- Adicionar coluna TIPO na tabela clientes
ALTER TABLE clientes ADD COLUMN tipo_cliente TEXT;

-- Atualizar o template de mapeamento para incluir a coluna TIPO
UPDATE field_mappings 
SET target_field = 'tipo_cliente', 
    source_field = 'TIPO',
    active = true
WHERE template_name = 'MobileMed - Clientes' 
  AND source_field = 'TIPO';

-- Se não existe, inserir o mapeamento
INSERT INTO field_mappings (
  template_name, file_type, source_field, target_field, target_table, 
  field_type, is_required, order_index, active, created_at, updated_at
)
SELECT 
  'MobileMed - Clientes', 'clientes', 'TIPO', 'tipo_cliente', 'clientes',
  'text', false, 4, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM field_mappings 
  WHERE template_name = 'MobileMed - Clientes' 
    AND source_field = 'TIPO'
);