-- Desativar trigger aplicar_regras_basicas_trigger para uploads mais rápidos
-- As funcionalidades foram migradas para aplicar-27-regras-completas:
-- - v001c: Normalização de nomes de médicos (mapeamento_nomes_medicos)
-- - v001d: De-Para valores zerados (valores_referencia_de_para)
-- - v005: Correções de modalidade (CR/DX→RX/MG, OT→DO, BMD→DO)
-- - Limpeza de nomes de clientes já estava nas 28 regras

-- Desativar o trigger (manter função para possível reativação futura)
DROP TRIGGER IF EXISTS trigger_regras_basicas ON public.volumetria_mobilemed;

-- Comentário no audit_logs para rastreabilidade
INSERT INTO public.audit_logs (
  operation,
  table_name,
  record_id,
  new_data,
  severity,
  evento_tipo
) VALUES (
  'TRIGGER_DISABLED',
  'volumetria_mobilemed',
  'trigger_regras_basicas',
  '{"motivo": "Funcionalidades migradas para aplicar-27-regras-completas edge function", "regras_migradas": ["v001c - normalização médicos", "v001d - de-para valores", "v005 - correções modalidade"]}'::jsonb,
  'info',
  'MIGRATION'
);