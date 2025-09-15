-- Atualizar omie_codigo_contrato para os 3 clientes com códigos ausentes
UPDATE contratos_clientes 
SET omie_codigo_contrato = '8559944845',
    omie_data_sincronizacao = now()
WHERE numero_contrato = 'CT-1757970797310-408f9244' 
  AND cliente_id IN (SELECT id FROM clientes WHERE nome = 'CORTREL');

UPDATE contratos_clientes 
SET omie_codigo_contrato = '8556006700',
    omie_data_sincronizacao = now()
WHERE numero_contrato = 'CT-1757970797509-eea86441'
  AND cliente_id IN (SELECT id FROM clientes WHERE nome = 'COT');

UPDATE contratos_clientes 
SET omie_codigo_contrato = '8556006918',
    omie_data_sincronizacao = now()
WHERE numero_contrato = 'CT-1757970804008-5fc5915a'
  AND cliente_id IN (SELECT id FROM clientes WHERE nome = 'IMDBATATAIS');