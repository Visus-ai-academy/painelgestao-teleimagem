-- Limpar dados duplicados na tabela volumetria_mobilemed
-- Manter apenas o registro mais recente de cada duplicata

WITH duplicados AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY "EMPRESA", "NOME_PACIENTE", "ACCESSION_NUMBER", arquivo_fonte 
           ORDER BY created_at DESC
         ) as rn
  FROM volumetria_mobilemed
  WHERE "ACCESSION_NUMBER" IS NOT NULL
)
DELETE FROM volumetria_mobilemed 
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);

-- Também limpar duplicatas onde ACCESSION_NUMBER é nulo
WITH duplicados_sem_accession AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY "EMPRESA", "NOME_PACIENTE", "ESTUDO_DESCRICAO", arquivo_fonte, "DATA_REALIZACAO"
           ORDER BY created_at DESC
         ) as rn
  FROM volumetria_mobilemed
  WHERE "ACCESSION_NUMBER" IS NULL
)
DELETE FROM volumetria_mobilemed 
WHERE id IN (
  SELECT id FROM duplicados_sem_accession WHERE rn > 1
);