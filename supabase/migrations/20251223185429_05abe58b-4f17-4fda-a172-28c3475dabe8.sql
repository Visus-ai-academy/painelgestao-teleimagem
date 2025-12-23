-- Correção direta: CT/MR + MEDICINA INTERNA + CABEÇA/PESCOÇO → NEURO
-- Atualiza os registros que deveriam ter sido corrigidos pela regra v007b

UPDATE volumetria_mobilemed 
SET "ESPECIALIDADE" = 'NEURO',
    updated_at = now()
WHERE "MODALIDADE" IN ('CT', 'MR') 
  AND "ESPECIALIDADE" = 'MEDICINA INTERNA'
  AND ("CATEGORIA" = 'CABEÇA' OR "CATEGORIA" = 'PESCOÇO' OR "CATEGORIA" ILIKE '%CABEC%' OR "CATEGORIA" ILIKE '%PESCO%');