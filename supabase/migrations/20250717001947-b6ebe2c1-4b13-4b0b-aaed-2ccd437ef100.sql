-- Primeiro: Remover todos os exames vinculados aos clientes mock
DELETE FROM exames_realizados 
WHERE cliente_id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003'
);

-- Segundo: Remover os clientes fictícios/mock da base de dados
DELETE FROM clientes 
WHERE nome IN (
  'Hospital São Lucas',
  'Clínica Vida Plena', 
  'Centro Médico Norte'
)
OR email IN (
  'contato@saolucas.com.br',
  'admin@vidaplena.com.br',
  'faturamento@centronorte.com.br'
)
OR id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003'
);