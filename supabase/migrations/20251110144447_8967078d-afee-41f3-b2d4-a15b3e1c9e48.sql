-- Corrigir triggers da tabela processamento_uploads que estão tentando acessar campos inexistentes

-- Remover triggers antigos
DROP TRIGGER IF EXISTS auto_aplicar_regras_trigger ON processamento_uploads;
DROP TRIGGER IF EXISTS trigger_aplicar_regras_pos_upload ON processamento_uploads;
DROP TRIGGER IF EXISTS trigger_upload_concluido ON processamento_uploads;

-- Recriar a função com os campos corretos
CREATE OR REPLACE FUNCTION trigger_auto_aplicar_regras()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só criar task quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Extrair lote_upload do detalhes_erro
    DECLARE
      v_lote_upload text;
    BEGIN
      v_lote_upload := NEW.detalhes_erro->>'lote_upload';
      
      IF v_lote_upload IS NOT NULL THEN
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
            'arquivo_fonte', NEW.tipo_arquivo,
            'lote_upload', v_lote_upload,
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
                jsonb_build_object('upload_id', NEW.id, 'tipo_arquivo', NEW.tipo_arquivo),
                'system', 'info');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erros para não bloquear o update
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar a função aplicar_regras_automatico com os campos corretos
CREATE OR REPLACE FUNCTION aplicar_regras_automatico()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só aplicar quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Verificar se é arquivo que precisa de regras
    IF NEW.tipo_arquivo IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao') THEN
      
      -- Extrair lote_upload do detalhes_erro
      DECLARE
        v_lote_upload text;
      BEGIN
        v_lote_upload := NEW.detalhes_erro->>'lote_upload';
        
        -- Log no audit_logs
        INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
        VALUES ('processamento_uploads', 'TRIGGER_REGRAS', NEW.id::text, 
                jsonb_build_object('tipo_arquivo', NEW.tipo_arquivo, 'lote_upload', v_lote_upload),
                'sistema-automatico', 'info');
      EXCEPTION WHEN OTHERS THEN
        -- Ignorar erros para não bloquear o update
        NULL;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar os triggers
CREATE TRIGGER trigger_aplicar_regras_pos_upload
  AFTER UPDATE ON processamento_uploads
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_automatico();

CREATE TRIGGER trigger_upload_concluido
  AFTER UPDATE ON processamento_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_aplicar_regras();