-- Corrigir os 118 registros com MODALIDADE = 'DO' e ESPECIALIDADE incorreta 'MUSCULO ESQUELETICO'
UPDATE volumetria_mobilemed
SET "ESPECIALIDADE" = 'D.O',
    updated_at = NOW()
WHERE "MODALIDADE" = 'DO' 
AND "ESPECIALIDADE" = 'MUSCULO ESQUELETICO'
AND periodo_referencia = '2025-10';