
-- Corrigir registros com CATEGORIA CABEÇA ou PESCOÇO que estão com especialidade errada
-- Baseado no cadastro_exames, CABEÇA e PESCOÇO devem ter ESPECIALIDADE = NEURO

UPDATE volumetria_mobilemed 
SET "ESPECIALIDADE" = 'NEURO'
WHERE ("CATEGORIA" = 'CABEÇA' OR "CATEGORIA" = 'PESCOÇO')
  AND "ESPECIALIDADE" != 'NEURO'
  AND periodo_referencia = '2025-10';
