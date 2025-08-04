-- Aplicar valores DE-PARA com matching flexível
UPDATE volumetria_mobilemed vm
SET "VALORES" = vr.valores,
    updated_at = now()
FROM valores_referencia_de_para vr
WHERE UPPER(TRIM(REPLACE(REPLACE(vm."ESTUDO_DESCRICAO", '(ONCO)', ''), '(TEP)', ''))) = UPPER(TRIM(vr.estudo_descricao))
  AND vr.ativo = true
  AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL);