-- Limpar sufixo "- TELE" e outros dos campos nome e nome_mobilemed na tabela clientes
UPDATE clientes 
SET 
  nome = TRIM(REGEXP_REPLACE(nome, ' - TELE$', '', 'i')),
  nome_mobilemed = TRIM(REGEXP_REPLACE(COALESCE(nome_mobilemed, ''), ' - TELE$', '', 'i'))
WHERE 
  nome LIKE '% - TELE' OR 
  nome_mobilemed LIKE '% - TELE';

-- Aplicar outras limpezas usando a função limpar_nome_cliente
UPDATE clientes
SET 
  nome = public.limpar_nome_cliente(nome),
  nome_mobilemed = public.limpar_nome_cliente(COALESCE(nome_mobilemed, nome))
WHERE 
  nome LIKE '%-CT' OR 
  nome LIKE '%-MR' OR 
  nome LIKE '%_PLANTÃO' OR 
  nome LIKE '%_RMX' OR
  nome_mobilemed LIKE '%-CT' OR 
  nome_mobilemed LIKE '%-MR' OR 
  nome_mobilemed LIKE '%_PLANTÃO' OR 
  nome_mobilemed LIKE '%_RMX';