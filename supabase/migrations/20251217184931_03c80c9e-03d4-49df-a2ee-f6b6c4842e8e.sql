
-- Atualizar parametros_faturamento do CEMMIT com o novo cliente_id
UPDATE parametros_faturamento 
SET cliente_id = '67a1684a-e18c-455e-8aac-86a91d5025a3'
WHERE nome_mobilemed = 'CEMMIT' AND cliente_id IS NULL;
