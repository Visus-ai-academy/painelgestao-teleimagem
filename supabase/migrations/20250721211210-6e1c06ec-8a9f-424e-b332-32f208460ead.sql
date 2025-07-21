-- Corrigir mapeamento para corresponder exatamente ao campo do arquivo
UPDATE field_mappings 
SET source_field = 'Contagem de Cliente (Nome Fantasia)'
WHERE file_type = 'clientes' 
AND target_field = 'nome' 
AND template_name = 'MobileMed - Clientes';

-- Verificar e corrigir outros campos conforme o template sincronizado
UPDATE field_mappings 
SET source_field = 'endereço'
WHERE file_type = 'clientes' 
AND target_field = 'endereco' 
AND template_name = 'MobileMed - Clientes';

UPDATE field_mappings 
SET source_field = 'data inicio contrato'
WHERE file_type = 'clientes' 
AND target_field = 'data_inicio_contrato' 
AND template_name = 'MobileMed - Clientes';

UPDATE field_mappings 
SET source_field = 'data termino de vigência'
WHERE file_type = 'clientes' 
AND target_field = 'data_termino_vigencia' 
AND template_name = 'MobileMed - Clientes';

UPDATE field_mappings 
SET source_field = 'cod cliente'
WHERE file_type = 'clientes' 
AND target_field = 'cod_cliente' 
AND template_name = 'MobileMed - Clientes';