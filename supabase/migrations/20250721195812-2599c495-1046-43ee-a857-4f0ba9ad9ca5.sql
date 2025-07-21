-- Remover campos que não existem na tabela clientes
DELETE FROM field_mappings 
WHERE template_name = 'MobileMed - Clientes' 
AND file_type = 'clientes' 
AND target_field IN ('data inicio contrato', 'data termino de vigência', 'cod cliente');

-- Corrigir mapeamentos incorretos
UPDATE field_mappings 
SET target_field = 'email' 
WHERE template_name = 'MobileMed - Clientes' 
AND file_type = 'clientes' 
AND target_field = 'e-mail';

UPDATE field_mappings 
SET target_field = 'telefone' 
WHERE template_name = 'MobileMed - Clientes' 
AND file_type = 'clientes' 
AND target_field = 'contato';

-- Remover campo "Cliente (Razão Social)" que não existe na tabela
DELETE FROM field_mappings 
WHERE template_name = 'MobileMed - Clientes' 
AND file_type = 'clientes' 
AND target_field = 'Cliente (Razão Social)';