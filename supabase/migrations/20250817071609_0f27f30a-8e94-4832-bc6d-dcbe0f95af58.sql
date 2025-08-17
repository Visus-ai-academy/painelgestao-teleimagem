-- Aplicar categoria padrão "SC" aos registros que não têm categoria
UPDATE volumetria_mobilemed 
SET "CATEGORIA" = 'SC' 
WHERE ("CATEGORIA" IS NULL OR "CATEGORIA" = '')
  AND arquivo_fonte != 'volumetria_onco_padrao';