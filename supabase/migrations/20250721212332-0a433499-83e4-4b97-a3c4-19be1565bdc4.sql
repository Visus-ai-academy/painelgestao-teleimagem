-- Corrigir o mapeamento do campo nome para usar "Cliente (Nome Fantasia)" 
UPDATE field_mappings 
SET source_field = 'Cliente (Nome Fantasia)'
WHERE file_type = 'clientes' 
AND target_field = 'nome' 
AND template_name = 'MobileMed - Clientes';