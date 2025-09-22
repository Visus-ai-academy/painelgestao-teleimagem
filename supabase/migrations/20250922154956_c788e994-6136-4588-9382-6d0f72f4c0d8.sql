-- Remover versões antigas da função calcular_preco_exame para evitar ambiguidade
DROP FUNCTION IF EXISTS calcular_preco_exame(uuid, text, text, text, text, integer, boolean);
DROP FUNCTION IF EXISTS calcular_preco_exame(uuid, text, text, text, text, integer, text);

-- Testar a função corrigida
SELECT calcular_preco_exame(
  '2298180b-b591-4b13-bc01-f6b5085d203e'::uuid, -- AKCPALMAS client_id
  'CT',
  'MUSCULO ESQUELETICO', 
  'SC',
  'URGÊNCIA',
  1
) as valor_calculado;