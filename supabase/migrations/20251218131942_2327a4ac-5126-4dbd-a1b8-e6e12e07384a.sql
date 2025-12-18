
-- Atualizar cadastro_exames: ANGIOTC VENOSA TORAX CARDIOLOGIA para categoria SC
UPDATE cadastro_exames
SET categoria = 'SC', updated_at = NOW()
WHERE nome = 'ANGIOTC VENOSA TORAX CARDIOLOGIA';

-- Atualizar registros na volumetria com esse exame
UPDATE volumetria_mobilemed
SET "CATEGORIA" = 'SC', updated_at = NOW()
WHERE "ESTUDO_DESCRICAO" = 'ANGIOTC VENOSA TORAX CARDIOLOGIA'
  AND "CATEGORIA" = 'ANGIO';
