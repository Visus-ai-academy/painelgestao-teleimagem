-- Corrigir mapeamento do campo nome para usar NOME_MOBILEMED
UPDATE field_mappings 
SET source_field = 'NOME_MOBILEMED' 
WHERE template_name = 'MobileMed - Clientes' 
  AND target_field = 'nome' 
  AND file_type = 'clientes';