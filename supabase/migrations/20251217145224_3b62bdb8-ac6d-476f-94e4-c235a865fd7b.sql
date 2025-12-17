
-- Atualizar período de referência ativo para outubro/2025
UPDATE periodo_referencia_ativo
SET 
  periodo_referencia = 'out/25',
  descricao = 'Período ativo: out/25',
  data_inicio = '2025-10-08',
  data_fim = '2025-11-07',
  updated_at = NOW()
WHERE ativo = true;
