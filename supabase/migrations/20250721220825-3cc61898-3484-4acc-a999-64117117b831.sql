-- Atualizar as colunas de detecção automática para o template de clientes
UPDATE import_templates 
SET auto_detect_columns = '["cliente", "cnpj", "email", "contato"]'::jsonb
WHERE name = 'MobileMed - Clientes';

-- Verificar outros templates e corrigir se necessário
UPDATE import_templates 
SET auto_detect_columns = '["data_exame", "paciente_nome", "medico", "modalidade"]'::jsonb
WHERE name = 'MobileMed - Exames';

UPDATE import_templates 
SET auto_detect_columns = '["nome", "crm", "especialidade"]'::jsonb
WHERE name = 'MobileMed - Médicos';

UPDATE import_templates 
SET auto_detect_columns = '["data", "medico", "turno", "modalidade"]'::jsonb
WHERE name = 'MobileMed - Escalas';

UPDATE import_templates 
SET auto_detect_columns = '["numero_fatura", "cliente_nome", "valor", "data_emissao"]'::jsonb
WHERE name = 'MobileMed - Faturamento';