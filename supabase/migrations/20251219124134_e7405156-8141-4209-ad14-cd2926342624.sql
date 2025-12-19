-- Corrigir contagem do upload retroativo existente
UPDATE processamento_uploads 
SET registros_inseridos = 16707
WHERE id = 'cd6851dc-33b5-4782-b1d5-741d8fd76452';