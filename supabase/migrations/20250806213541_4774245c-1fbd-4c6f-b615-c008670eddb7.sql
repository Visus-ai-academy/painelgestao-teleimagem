-- Criar função para encerrar uploads travados
CREATE OR REPLACE FUNCTION encerrar_uploads_travados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uploads_travados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Encerrar uploads que estão processando há mais de 30 minutos
  UPDATE processamento_uploads 
  SET status = 'erro',
      detalhes_erro = 'Upload encerrado automaticamente - timeout de 30 minutos'
  WHERE status = 'processando' 
    AND created_at < NOW() - INTERVAL '30 minutes';
  
  GET DIAGNOSTICS uploads_travados = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('processamento_uploads', 'FORCE_STOP', 'bulk', 
          jsonb_build_object('uploads_encerrados', uploads_travados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'warning');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'uploads_encerrados', uploads_travados,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;