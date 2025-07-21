-- Deletar os 3 clientes fictícios de teste
DELETE FROM clientes WHERE nome IN (
  'Hospital São Lucas',
  'Clínica Vida Plena', 
  'Centro Médico Excellence'
);