-- Padronizar o registro CDI.URUACU de "jun/25" para "2025-06"
UPDATE volumetria_mobilemed 
SET periodo_referencia = '2025-06'
WHERE "EMPRESA" = 'CDI.URUACU' 
  AND periodo_referencia = 'jun/25';