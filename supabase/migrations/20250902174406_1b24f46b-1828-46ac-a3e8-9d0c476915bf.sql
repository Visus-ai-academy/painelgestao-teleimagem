-- Primeiro, habilitar apenas os triggers existentes
ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_aplicar_regras_completas;
ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_regras_basicas;

-- Recriar o trigger que cria tasks automáticas quando upload é concluído
CREATE OR REPLACE FUNCTION trigger_auto_aplicar_regras()
RETURNS TRIGGER AS $$
BEGIN
  -- Só criar task quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    INSERT INTO system_tasks (
      task_type,
      task_data,
      status,
      priority,
      attempts,
      max_attempts
    ) VALUES (
      'APLICAR_REGRAS_AUTO',
      jsonb_build_object(
        'arquivo_fonte', NEW.arquivo_fonte,
        'lote_upload', NEW.lote_upload,
        'upload_id', NEW.id::text
      ),
      'pendente',
      1,
      0,
      3
    );
    
    -- Log no audit_logs
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('system_tasks', 'INSERT', 'auto-aplicar-regras', 
            jsonb_build_object('upload_id', NEW.id, 'arquivo_fonte', NEW.arquivo_fonte),
            'system', 'info');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger na tabela processamento_uploads
DROP TRIGGER IF EXISTS auto_aplicar_regras_trigger ON processamento_uploads;
CREATE TRIGGER auto_aplicar_regras_trigger
  AFTER UPDATE ON processamento_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_aplicar_regras();