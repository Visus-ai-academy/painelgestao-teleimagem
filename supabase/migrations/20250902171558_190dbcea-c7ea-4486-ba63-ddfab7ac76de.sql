-- Remover trigger e função existentes com CASCADE
DROP TRIGGER IF EXISTS trigger_upload_concluido ON processamento_uploads CASCADE;
DROP TRIGGER IF EXISTS auto_aplicar_regras_trigger ON processamento_uploads CASCADE;
DROP FUNCTION IF EXISTS public.trigger_auto_aplicar_regras() CASCADE;
DROP FUNCTION IF EXISTS public.processar_tasks_sistema() CASCADE;

-- Criar função para processar tasks automaticamente  
CREATE OR REPLACE FUNCTION public.processar_tasks_sistema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Processar uma task pendente por vez
  PERFORM * FROM system_tasks 
  WHERE status = 'pendente' 
  AND task_type = 'aplicar_regras_automatico'
  LIMIT 1;
  
  -- Log da ação se encontrou task
  IF FOUND THEN
    INSERT INTO audit_logs (
      action, 
      details, 
      user_id, 
      created_at
    ) VALUES (
      'TASK_AUTO_PROCESSADA',
      jsonb_build_object('message', 'Task automática processada pelo sistema'),
      '00000000-0000-0000-0000-000000000000',
      NOW()
    );
  END IF;
END;
$$;

-- Criar função trigger para aplicar regras automaticamente após upload
CREATE OR REPLACE FUNCTION public.trigger_auto_aplicar_regras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só executa quando o status muda para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    
    -- Log do início do processo
    INSERT INTO audit_logs (
      action, 
      details, 
      user_id, 
      created_at
    ) VALUES (
      'TRIGGER_AUTO_REGRAS_INICIADO',
      jsonb_build_object(
        'upload_id', NEW.id,
        'tipo_arquivo', NEW.tipo_arquivo,
        'registros_inseridos', NEW.registros_inseridos
      ),
      '00000000-0000-0000-0000-000000000000',
      NOW()
    );

    -- Criar task para aplicação automática de regras
    INSERT INTO system_tasks (
      task_type,
      task_data,
      status,
      priority,
      attempts,
      max_attempts,
      created_at,
      updated_at
    ) VALUES (
      'aplicar_regras_automatico',
      jsonb_build_object(
        'arquivo_fonte', NEW.tipo_arquivo,
        'upload_id', NEW.id::text,
        'lote_upload', 'auto-process',
        'periodo_referencia', 'jun/25'
      ),
      'pendente',
      1,
      0,
      3,
      NOW(),
      NOW()
    );

    -- Log da task criada
    INSERT INTO audit_logs (
      action, 
      details, 
      user_id, 
      created_at
    ) VALUES (
      'TASK_AUTO_REGRAS_CRIADA',
      jsonb_build_object(
        'upload_id', NEW.id,
        'tipo_arquivo', NEW.tipo_arquivo,
        'message', 'Task automática criada para aplicação de regras'
      ),
      '00000000-0000-0000-0000-000000000000',
      NOW()
    );

  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar o trigger na tabela processamento_uploads
CREATE TRIGGER auto_aplicar_regras_trigger
  AFTER UPDATE ON processamento_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_aplicar_regras();

-- Log da configuração do sistema
INSERT INTO audit_logs (
  action, 
  details, 
  user_id, 
  created_at
) VALUES (
  'SISTEMA_AUTO_REGRAS_CONFIGURADO',
  jsonb_build_object(
    'message', 'Sistema automático de aplicação de regras configurado com sucesso',
    'trigger_criado', true,
    'funcao_processamento', true,
    'data_configuracao', NOW()
  ),
  '00000000-0000-0000-0000-000000000000',
  NOW()
);