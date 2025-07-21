-- Adicionar mapeamento para o campo Status
INSERT INTO field_mappings (
  template_name, file_type, source_field, target_field, target_table, 
  field_type, is_required, order_index, active
) VALUES (
  'MobileMed - Clientes', 'clientes', 'Status', 'status', 'clientes', 
  'text', false, 6, true
)
ON CONFLICT DO NOTHING;

-- Atualizar os order_index para reorganizar a ordem
UPDATE field_mappings 
SET order_index = CASE 
  WHEN source_field = 'Status' THEN 6
  WHEN source_field = 'data inicio contrato' THEN 7  
  WHEN source_field = 'data termino de vigência' THEN 8
  WHEN source_field = 'cod cliente' THEN 9
END
WHERE template_name = 'MobileMed - Clientes' 
AND source_field IN ('Status', 'data inicio contrato', 'data termino de vigência', 'cod cliente');