-- Corrigir mapeamento do campo nome para o arquivo de clientes
UPDATE field_mappings 
SET source_field = 'Contagem de Cliente (Nome Fantasia)' 
WHERE template_name = 'MobileMed - Clientes' 
  AND target_field = 'nome' 
  AND file_type = 'clientes';