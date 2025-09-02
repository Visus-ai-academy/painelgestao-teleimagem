-- Criar trigger para aplicação automática de regras após upload concluído
CREATE OR REPLACE FUNCTION trigger_auto_aplicar_regras()
RETURNS TRIGGER AS $$
DECLARE
  v_upload_info RECORD;
BEGIN
  -- Só disparar quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    
    -- Buscar informações do upload
    SELECT 
      arquivo_nome,
      tipo_arquivo,
      periodo_referencia
    INTO v_upload_info
    FROM processamento_uploads 
    WHERE id = NEW.id;
    
    -- Log do trigger
    INSERT INTO audit_logs (
      table_name, 
      operation, 
      record_id, 
      new_data, 
      user_email, 
      severity
    ) VALUES (
      'processamento_uploads',
      'TRIGGER_AUTO_REGRAS',
      NEW.id::text,
      jsonb_build_object(
        'arquivo_nome', v_upload_info.arquivo_nome,
        'tipo_arquivo', v_upload_info.tipo_arquivo,
        'periodo_referencia', v_upload_info.periodo_referencia,
        'registros_inseridos', NEW.registros_inseridos
      ),
      'system',
      'info'
    );
    
    -- Inserir task para aplicação de regras (será processada por job assíncrono)
    INSERT INTO system_tasks (
      task_type,
      task_data,
      status,
      priority,
      created_at
    ) VALUES (
      'aplicar_regras_automatico',
      jsonb_build_object(
        'upload_id', NEW.id,
        'arquivo_fonte', CASE 
          WHEN v_upload_info.tipo_arquivo LIKE '%retroativo%' THEN v_upload_info.tipo_arquivo
          ELSE 'volumetria_padrao'
        END,
        'lote_upload', NEW.id::text,
        'periodo_referencia', v_upload_info.periodo_referencia
      ),
      'pendente',
      1,
      now()
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela para tasks do sistema se não existir
CREATE TABLE IF NOT EXISTS system_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  task_data JSONB NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  priority INTEGER DEFAULT 1,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Criar trigger na tabela processamento_uploads
DROP TRIGGER IF EXISTS trigger_upload_concluido ON processamento_uploads;
CREATE TRIGGER trigger_upload_concluido
  AFTER UPDATE ON processamento_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_aplicar_regras();

-- Função para processar tasks pendentes
CREATE OR REPLACE FUNCTION processar_tasks_sistema()
RETURNS JSONB AS $$
DECLARE
  task_record RECORD;
  resultado JSONB;
  task_data JSONB;
BEGIN
  -- Buscar próxima task pendente
  SELECT * INTO task_record
  FROM system_tasks 
  WHERE status = 'pendente' 
    AND attempts < max_attempts
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('message', 'Nenhuma task pendente');
  END IF;
  
  -- Marcar como processando
  UPDATE system_tasks 
  SET status = 'processando', 
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = task_record.id;
  
  task_data := task_record.task_data;
  
  -- Processar baseado no tipo
  IF task_record.task_type = 'aplicar_regras_automatico' THEN
    
    -- Chamar sistema de regras otimizado via função Supabase
    -- (será implementado via edge function call no frontend)
    
    -- Marcar como concluído temporariamente
    UPDATE system_tasks 
    SET status = 'concluido',
        processed_at = now(),
        updated_at = now()
    WHERE id = task_record.id;
    
    resultado := jsonb_build_object(
      'task_id', task_record.id,
      'status', 'processado',
      'message', 'Task de regras automáticas criada'
    );
    
  ELSE
    -- Tipo de task desconhecido
    UPDATE system_tasks 
    SET status = 'erro',
        error_message = 'Tipo de task desconhecido',
        updated_at = now()
    WHERE id = task_record.id;
    
    resultado := jsonb_build_object(
      'error', 'Tipo de task desconhecido: ' || task_record.task_type
    );
  END IF;
  
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;