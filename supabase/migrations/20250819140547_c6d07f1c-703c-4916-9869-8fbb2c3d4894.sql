-- Otimizar função limpar_uploads_travados para ser mais eficiente
CREATE OR REPLACE FUNCTION public.limpar_uploads_travados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uploads_corrigidos INTEGER := 0;
  staging_limpo INTEGER := 0;
BEGIN
  -- Marcar uploads antigos como erro (reduzido de 10 para 5 minutos)
  UPDATE processamento_uploads 
  SET 
    status = 'erro',
    detalhes_erro = jsonb_build_object(
      'etapa', 'timeout',
      'motivo', 'Upload travado por mais de 5 minutos',
      'corrigido_em', now()
    ),
    completed_at = now()
  WHERE status IN ('processando', 'pendente', 'staging_concluido') 
    AND created_at < now() - interval '5 minutes';
  
  GET DIAGNOSTICS uploads_corrigidos = ROW_COUNT;
  
  -- Limpar staging órfão (reduzido de 30 para 15 minutos)
  DELETE FROM volumetria_staging 
  WHERE created_at < now() - interval '15 minutes'
    AND status_processamento = 'pendente';
  
  GET DIAGNOSTICS staging_limpo = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (
    tabela_afetada,
    acao,
    detalhes
  ) VALUES (
    'processamento_uploads',
    'limpeza_uploads_travados',
    jsonb_build_object(
      'uploads_corrigidos', uploads_corrigidos,
      'staging_limpo', staging_limpo,
      'timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Uploads travados limpos com sucesso',
    'uploads_corrigidos', uploads_corrigidos,
    'staging_limpo', staging_limpo
  );
END;
$$;

-- Criar função para monitorar uploads em tempo real
CREATE OR REPLACE FUNCTION public.monitorar_upload_status(upload_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  upload_info RECORD;
  staging_count INTEGER := 0;
  volumetria_count INTEGER := 0;
BEGIN
  -- Buscar informações do upload
  SELECT * INTO upload_info
  FROM processamento_uploads
  WHERE id = upload_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Upload não encontrado'
    );
  END IF;
  
  -- Contar registros no staging
  SELECT COUNT(*) INTO staging_count
  FROM volumetria_staging
  WHERE lote_upload = (upload_info.detalhes_erro->>'lote_upload');
  
  -- Contar registros na volumetria final
  SELECT COUNT(*) INTO volumetria_count
  FROM volumetria_mobilemed
  WHERE lote_upload = (upload_info.detalhes_erro->>'lote_upload');
  
  RETURN jsonb_build_object(
    'success', true,
    'upload', row_to_json(upload_info),
    'staging_count', staging_count,
    'volumetria_count', volumetria_count,
    'progress_percentage', CASE 
      WHEN upload_info.registros_processados > 0 THEN
        LEAST(100, (volumetria_count::float / upload_info.registros_processados::float * 100)::integer)
      ELSE 0
    END
  );
END;
$$;