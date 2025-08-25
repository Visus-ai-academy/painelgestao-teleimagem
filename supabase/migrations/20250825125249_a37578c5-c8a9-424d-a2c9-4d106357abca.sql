-- CORREÇÃO: SIMPLIFICAR PROCESSAMENTO AUTOMÁTICO
-- Problema: Múltiplos triggers duplicados causam conflitos

-- 1. REMOVER TODOS OS TRIGGERS DUPLICADOS (exceto o essencial)
DROP TRIGGER IF EXISTS trigger_aplicar_regras_completas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_regras_completas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_quebra_automatica_before_insert ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_marcar_quebra_pendente ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_de_para_prioridade ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_mapeamento_nome_fantasia ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_populate_nome_fantasia ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_volumetria_normalizar_medico ON volumetria_mobilemed;

-- 2. MANTER APENAS 3 TRIGGERS ESSENCIAIS:
-- - trigger_processamento_automatico_volumetria (processamento completo)
-- - trigger_data_referencia (definir data de referência)
-- - set_data_referencia_trigger (backup para data de referência)

-- 3. VERIFICAR SE O TRIGGER PRINCIPAL EXISTE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_processamento_automatico_volumetria'
  ) THEN
    -- Criar trigger simplificado
    CREATE TRIGGER trigger_processamento_automatico_volumetria
      BEFORE INSERT OR UPDATE ON volumetria_mobilemed
      FOR EACH ROW
      EXECUTE FUNCTION trigger_aplicar_regras_completas();
  END IF;
END $$;

-- 4. LOG DA CORREÇÃO
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema_triggers', 'CLEANUP', 'simplificacao_triggers', 
        jsonb_build_object(
          'acao', 'Simplificação do sistema de triggers',
          'triggers_removidos', ARRAY[
            'trigger_aplicar_regras_completas',
            'trigger_regras_completas', 
            'trigger_quebra_automatica_before_insert',
            'trigger_marcar_quebra_pendente',
            'trigger_aplicar_de_para_prioridade',
            'trigger_aplicar_mapeamento_nome_fantasia',
            'trigger_populate_nome_fantasia',
            'trigger_volumetria_normalizar_medico'
          ],
          'triggers_mantidos', ARRAY[
            'trigger_processamento_automatico_volumetria (PRINCIPAL)',
            'trigger_data_referencia',
            'set_data_referencia_trigger'
          ],
          'processamento_automatico', 'ATIVO - SEM EDGE FUNCTIONS MANUAIS',
          'resultado', 'Sistema simplificado com processamento totalmente automático'
        ),
        'system', 'critical');