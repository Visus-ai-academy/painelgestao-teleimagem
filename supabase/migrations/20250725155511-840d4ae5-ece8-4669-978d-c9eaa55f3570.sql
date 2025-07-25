-- Corrigir valores incorretos nos arquivos fora padrão
-- Primeiro, zerar valores que parecem ser monetários (muito altos) para reaplicar corretamente

UPDATE volumetria_mobilemed 
SET "VALORES" = 0, updated_at = now()
WHERE arquivo_fonte IN ('volumetria_fora_padrao', 'volumetria_fora_padrao_retroativo')
  AND "VALORES" > 100;

-- Aplicar valores corretos da tabela de referência
UPDATE volumetria_mobilemed vm
SET "VALORES" = vr.valores, updated_at = now()
FROM valores_referencia_de_para vr
WHERE vm."ESTUDO_DESCRICAO" = vr.estudo_descricao
  AND vr.ativo = true
  AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
  AND vm.arquivo_fonte IN ('volumetria_fora_padrao', 'volumetria_fora_padrao_retroativo');