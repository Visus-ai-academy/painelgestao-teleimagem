-- Sincronizar nomes CEDI entre tabelas clientes e volumetria_mobilemed
UPDATE clientes 
SET nome_mobilemed = 'CEDIDIAG'
WHERE nome IN ('CEDI_RJ', 'CEDI_RO', 'CEDI-RJ', 'CEDI-RO', 'CEDI-UNIMED', 'CEDI_UNIMED')
  AND nome_fantasia = 'CEDIDIAG';