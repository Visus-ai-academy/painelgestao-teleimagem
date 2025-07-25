-- Corrigir valores que ainda estão incorretos (como 85) 
-- e não foram mapeados na tabela de referência

-- Primeiro, zerar todos os valores maiores que 3 para arquivos fora padrão
UPDATE volumetria_mobilemed 
SET "VALORES" = 0, updated_at = now()
WHERE arquivo_fonte IN ('volumetria_fora_padrao', 'volumetria_fora_padrao_retroativo')
  AND "VALORES" > 3;

-- Aplicar valor padrão 1 para exames que não têm correspondência na tabela De Para
UPDATE volumetria_mobilemed 
SET "VALORES" = 1, updated_at = now()
WHERE arquivo_fonte IN ('volumetria_fora_padrao', 'volumetria_fora_padrao_retroativo')
  AND ("VALORES" = 0 OR "VALORES" IS NULL)
  AND "ESTUDO_DESCRICAO" IS NOT NULL;