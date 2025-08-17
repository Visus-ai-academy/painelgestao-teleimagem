-- Corrigir data_referencia para jun/25 conforme regras de processamento retroativo
UPDATE volumetria_mobilemed 
SET 
  data_referencia = '2025-06-01',
  periodo_referencia = 'jun/25',
  updated_at = now()
WHERE "EMPRESA" = 'CDI.URUACU'
  AND "NOME_PACIENTE" = 'Eber Da Silva Pereira'
  AND "ESTUDO_DESCRICAO" = 'RX TORNOZELO DIREITO';