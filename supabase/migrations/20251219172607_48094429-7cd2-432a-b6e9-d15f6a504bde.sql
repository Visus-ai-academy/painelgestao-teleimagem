
-- =====================================================
-- CORREÇÃO CRÍTICA: Remover trigger com período hardcoded
-- =====================================================

-- 1. Remover trigger problemático
DROP TRIGGER IF EXISTS auto_aplicar_regras_trigger ON processamento_uploads CASCADE;

-- 2. Remover funções relacionadas  
DROP FUNCTION IF EXISTS public.trigger_auto_aplicar_regras() CASCADE;
DROP FUNCTION IF EXISTS public.processar_tasks_sistema() CASCADE;

-- 3. Limpar tasks pendentes com período errado
DELETE FROM system_tasks 
WHERE task_type = 'aplicar_regras_automatico'
  AND status = 'pendente'
  AND (task_data->>'periodo_referencia') = 'jun/25';

-- 4. Log da correção
INSERT INTO audit_logs (
  table_name,
  operation, 
  record_id,
  new_data, 
  user_email, 
  severity
) VALUES (
  'system',
  'CORRECAO_TRIGGER_PERIODO_HARDCODED',
  'trigger_auto_aplicar_regras',
  jsonb_build_object(
    'problema', 'Trigger estava passando periodo_referencia jun/25 hardcoded',
    'solucao', 'Trigger removido - processamento de regras agora ocorre apenas via edge function processar-volumetria-otimizado',
    'data_correcao', NOW()
  ),
  'system',
  'info'
);
