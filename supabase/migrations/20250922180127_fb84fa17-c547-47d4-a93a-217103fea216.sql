-- Remover todas as outras versões da função deixando apenas a corrigida
DROP FUNCTION pg_catalog.calcular_preco_exame(uuid, text, text, text, text, integer, boolean);
DROP FUNCTION pg_catalog.calcular_preco_exame(uuid, text, text, text, text, integer, text);

-- Testar a função corrigida
SELECT calcular_preco_exame(
  '2298180b-b591-4b13-bc01-f6b5085d203e'::uuid, -- AKCPALMAS client_id
  'CT'::text,
  'MUSCULO ESQUELETICO'::text, 
  'SC'::text,
  'URGÊNCIA'::text,
  1::integer
) as valor_calculado;