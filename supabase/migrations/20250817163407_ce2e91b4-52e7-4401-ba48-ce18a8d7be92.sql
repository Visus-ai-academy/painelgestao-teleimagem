-- CORREÇÃO FINAL: Aplicar todas as regras faltantes aos dados existentes
-- Aplicar categorias para registros ainda sem categoria
UPDATE volumetria_mobilemed vm
SET "CATEGORIA" = COALESCE(
  (SELECT ce.categoria 
   FROM cadastro_exames ce 
   WHERE ce.nome = vm."ESTUDO_DESCRICAO" 
   AND ce.ativo = true 
   AND ce.categoria IS NOT NULL 
   AND ce.categoria != '' 
   LIMIT 1),
  'SC'
)
WHERE vm."CATEGORIA" IS NULL OR vm."CATEGORIA" = '' OR vm."CATEGORIA" = 'SC';

-- Aplicar tipificação de faturamento para registros ainda sem tipificação
UPDATE volumetria_mobilemed vm
SET tipo_faturamento = CASE
  WHEN vm."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN 'oncologia'
  WHEN vm."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN 'urgencia'
  WHEN vm."MODALIDADE" IN ('CT', 'MR') THEN 'alta_complexidade'
  ELSE 'padrao'
END
WHERE vm.tipo_faturamento IS NULL;

-- Aplicar especialidade automaticamente onde ainda está faltando
UPDATE volumetria_mobilemed vm
SET "ESPECIALIDADE" = COALESCE(
  (SELECT ce.especialidade
   FROM cadastro_exames ce
   WHERE ce.nome = vm."ESTUDO_DESCRICAO"
   AND ce.ativo = true
   AND ce.especialidade IS NOT NULL
   AND ce.especialidade != ''
   LIMIT 1),
  vm."ESPECIALIDADE"
)
WHERE vm."ESPECIALIDADE" IS NULL OR vm."ESPECIALIDADE" = '';