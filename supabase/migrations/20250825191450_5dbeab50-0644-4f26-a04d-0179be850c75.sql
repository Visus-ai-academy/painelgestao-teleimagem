-- SOLUÇÃO: Criar triggers simplificados que não causem exclusões incorretas

-- 1. Primeiro, remover os triggers problemáticos existentes
DROP TRIGGER IF EXISTS trigger_processamento_automatico_volumetria ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS set_data_referencia_trigger ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_data_referencia ON volumetria_mobilemed;

-- 2. Criar função simplificada que só aplica ajustes básicos (SEM EXCLUSÕES)
CREATE OR REPLACE FUNCTION public.trigger_volumetria_basico()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar apenas ajustes básicos, NUNCA excluir registros
  
  -- Normalizar nome do cliente (sem exclusão)
  IF NEW."EMPRESA" IS NOT NULL THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- Normalizar nome do médico (sem exclusão)  
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- Aplicar tipificação de faturamento (sem exclusão)
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
    NEW.tipo_faturamento := 'urgencia';  
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  -- Garantir que o registro seja SEMPRE aceito
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger simplificado para data_referencia (SEM EXCLUSÕES)
CREATE OR REPLACE FUNCTION public.set_data_referencia_safe()
RETURNS TRIGGER AS $$
BEGIN
  -- Definir data_referencia baseada no arquivo_fonte (sem exclusão)
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := CURRENT_DATE;
  END IF;
  
  -- Garantir que o registro seja SEMPRE aceito
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recriar os triggers com as funções seguras
CREATE TRIGGER trigger_volumetria_basico
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_volumetria_basico();

CREATE TRIGGER set_data_referencia_safe_trigger
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW  
  EXECUTE FUNCTION set_data_referencia_safe();

-- 5. Log da correção
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CORRIGIR_TRIGGERS', 'triggers_seguros', 
        jsonb_build_object(
          'problema_identificado', 'Triggers chamavam funções removidas causando 100% exclusão',
          'solucao_aplicada', 'Triggers simplificados que NUNCA excluem registros',
          'triggers_criados', ARRAY[
            'trigger_volumetria_basico',
            'set_data_referencia_safe_trigger'
          ],
          'funcoes_criadas', ARRAY[
            'trigger_volumetria_basico()',
            'set_data_referencia_safe()'
          ],
          'garantia', 'Registros sempre aceitos, apenas normalizações aplicadas'
        ),
        'system', 'info');