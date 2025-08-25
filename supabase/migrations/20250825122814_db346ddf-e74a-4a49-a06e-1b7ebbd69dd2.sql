-- CENÁRIO 1: Consolidação de triggers - eliminando exclusões indevidas
-- Desabilitar todos os triggers problemáticos e manter apenas trigger_aplicar_regras_completas

-- 1. Remover trigger_volumetria_processamento (causa exclusões indevidas)
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- 2. Remover trigger_volumetria_processamento_completo (duplicação)
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

-- 3. Remover trigger_quebra_automatica (duplicação - já integrado)
DROP TRIGGER IF EXISTS trigger_quebra_automatica ON volumetria_mobilemed;

-- 4. Remover outros triggers automáticos que podem causar conflito
DROP TRIGGER IF EXISTS trigger_aplicar_regras_automaticas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_regras_automaticas ON volumetria_mobilemed;

-- 5. Garantir que apenas trigger_aplicar_regras_completas está ativo
-- Primeiro remover se existir
DROP TRIGGER IF EXISTS trigger_aplicar_regras_completas ON volumetria_mobilemed;

-- Recriar o trigger principal (já corrigido na migração anterior)
CREATE TRIGGER trigger_aplicar_regras_completas
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_regras_completas();

-- Log da consolidação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema_triggers', 'UPDATE', 'volumetria_mobilemed', 
        jsonb_build_object(
          'acao', 'Cenário 1 implementado',
          'triggers_removidos', ARRAY[
            'trigger_volumetria_processamento',
            'trigger_volumetria_processamento_completo', 
            'trigger_quebra_automatica',
            'trigger_aplicar_regras_automaticas'
          ],
          'trigger_mantido', 'trigger_aplicar_regras_completas',
          'beneficios', ARRAY[
            'Elimina exclusões indevidas',
            'Remove duplicação de processamento', 
            'Centraliza toda lógica em um trigger',
            'Mantém quebra automática integrada'
          ]
        ),
        'system', 'critical');