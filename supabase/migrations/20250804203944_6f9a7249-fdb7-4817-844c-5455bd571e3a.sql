-- Limpar contratos fictícios e atualizar com clientes reais

-- 1. Primeiro, limpar a tabela de contratos de clientes
TRUNCATE TABLE contratos_clientes CASCADE;

-- 2. Inserir contratos base para todos os clientes ativos
INSERT INTO contratos_clientes (
  cliente_id,
  numero_contrato,
  data_inicio,
  valor_mensal,
  status,
  forma_pagamento,
  dia_vencimento,
  modalidades,
  especialidades,
  observacoes,
  created_by
)
SELECT 
  c.id as cliente_id,
  'CONTRATO-' || UPPER(SUBSTRING(c.nome FROM 1 FOR 3)) || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((ROW_NUMBER() OVER (ORDER BY c.nome))::text, 3, '0') as numero_contrato,
  COALESCE(c.data_inicio_contrato, CURRENT_DATE) as data_inicio,
  0 as valor_mensal,
  'ativo' as status,
  'mensal' as forma_pagamento,
  10 as dia_vencimento,
  ARRAY['CT', 'MR', 'US', 'RX', 'MG', 'TC', 'ECG', 'ECO'] as modalidades,
  ARRAY['Radiologia', 'Cardiologia', 'Neurologia', 'Ortopedia', 'Gastroenterologia'] as especialidades,
  'Contrato base criado automaticamente - aguardando configuração de preços' as observacoes,
  (SELECT id FROM profiles WHERE email LIKE '%admin%' LIMIT 1)
FROM clientes c 
WHERE c.ativo = true
ORDER BY c.nome;