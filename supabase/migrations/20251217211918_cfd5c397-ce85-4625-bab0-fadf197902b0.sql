-- Remover triggers problemáticos da tabela processamento_uploads
-- Eles estão tentando acessar uma coluna que não existe nessa tabela

-- Remover trigger que chama aplicar_regras_automatico
DROP TRIGGER IF EXISTS trigger_aplicar_regras_pos_upload ON public.processamento_uploads;

-- Remover trigger que chama trigger_auto_aplicar_regras
DROP TRIGGER IF EXISTS trigger_upload_concluido ON public.processamento_uploads;

-- Dropar as funções problemáticas (não são mais necessárias)
DROP FUNCTION IF EXISTS aplicar_regras_automatico() CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_aplicar_regras() CASCADE;

-- Log da correção
INSERT INTO public.audit_logs (
  operation,
  table_name,
  record_id,
  new_data,
  severity,
  evento_tipo
) VALUES (
  'TRIGGER_FIX',
  'processamento_uploads',
  'trigger_aplicar_regras_pos_upload_trigger_upload_concluido',
  '{"motivo": "Triggers tentavam acessar coluna processamento_pendente que não existe em processamento_uploads", "triggers_removidos": ["trigger_aplicar_regras_pos_upload", "trigger_upload_concluido"], "funcoes_removidas": ["aplicar_regras_automatico", "trigger_auto_aplicar_regras"]}'::jsonb,
  'info',
  'BUG_FIX'
);