-- Correção dos dados específicos com especialidades/categorias inválidas

-- 1. COLUNAS → MUSCULO ESQUELETICO
UPDATE volumetria_mobilemed 
SET "ESPECIALIDADE" = 'MUSCULO ESQUELETICO',
    updated_at = now()
WHERE UPPER(TRIM("ESPECIALIDADE")) = 'COLUNAS' 
AND periodo_referencia = '2025-10';

-- 2. RX (especialidade) → TORAX (para modalidade RX)
UPDATE volumetria_mobilemed 
SET "ESPECIALIDADE" = 'TORAX',
    updated_at = now()
WHERE UPPER(TRIM("ESPECIALIDADE")) = 'RX' 
AND periodo_referencia = '2025-10';

-- 3. MEDICINA INTERNA + CABEÇA → NEURO (para CT/MR)
UPDATE volumetria_mobilemed 
SET "ESPECIALIDADE" = 'NEURO',
    updated_at = now()
WHERE "ESPECIALIDADE" = 'MEDICINA INTERNA' 
AND UPPER(TRIM("CATEGORIA")) = 'CABEÇA'
AND "MODALIDADE" IN ('CT', 'MR')
AND periodo_referencia = '2025-10';