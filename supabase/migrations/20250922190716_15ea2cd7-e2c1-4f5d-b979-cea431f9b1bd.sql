-- Remover versões antigas da função calcular_preco_exame
DROP FUNCTION IF EXISTS public.calcular_preco_exame(uuid, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.calcular_preco_exame(uuid, text, text, text, text, integer, boolean);

-- Testar a função nova
SELECT calcular_preco_exame(
  '90b4a4bc-a53a-4bf9-83c4-7a025c275cdd'::uuid, 
  'RX'::text, 
  'MEDICINA INTERNA'::text, 
  'SC'::text, 
  'URGÊNCIA'::text
);