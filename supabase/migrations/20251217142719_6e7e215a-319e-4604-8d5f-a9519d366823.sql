
-- Criar vínculos de-para para os exames zerados (nomes com acento → cadastro sem acento)
INSERT INTO valores_referencia_de_para (estudo_descricao, valores, cadastro_exame_id, ativo, created_at, updated_at)
VALUES 
  ('TÓRAX S/C', 1, '9095e82e-449c-46be-9284-472669e6fc0a', true, NOW(), NOW()),
  ('TÓRAX C/C', 1, '95d97ad0-c36c-4d33-93af-b6d6554bb354', true, NOW(), NOW()),
  ('CRANIO S/C', 1, '10129840-da98-43f7-946d-e41e74853236', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Aplicar os valores (1) aos exames zerados da volumetria baseado nos vínculos criados
UPDATE volumetria_mobilemed v
SET "VALORES" = 1
WHERE v."VALORES" = 0 
  AND (
    v."ESTUDO_DESCRICAO" = 'TÓRAX S/C' OR
    v."ESTUDO_DESCRICAO" = 'TÓRAX C/C' OR
    v."ESTUDO_DESCRICAO" = 'CRANIO S/C'
  );
