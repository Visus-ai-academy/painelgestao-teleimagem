-- Corrigir função limpar_uploads_travados (problema na coluna audit_logs)
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
  -- Marcar uploads antigos como erro
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
  
  -- Limpar staging órfão
  DELETE FROM volumetria_staging 
  WHERE created_at < now() - interval '15 minutes'
    AND status_processamento = 'pendente';
  
  GET DIAGNOSTICS staging_limpo = ROW_COUNT;
  
  -- Log da operação (usar colunas corretas da tabela audit_logs)
  INSERT INTO audit_logs (
    table_name,
    operation,
    record_id,
    new_data,
    user_email,
    severity
  ) VALUES (
    'processamento_uploads',
    'LIMPEZA_UPLOADS_TRAVADOS',
    uploads_corrigidos::text,
    jsonb_build_object(
      'uploads_corrigidos', uploads_corrigidos,
      'staging_limpo', staging_limpo,
      'timestamp', now()
    ),
    'system',
    'info'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Uploads travados limpos com sucesso',
    'uploads_corrigidos', uploads_corrigidos,
    'staging_limpo', staging_limpo
  );
END;
$$;

-- Função para testar o sistema completo
CREATE OR REPLACE FUNCTION public.testar_sistema_upload()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resultado jsonb;
  uploads_ativos INTEGER;
  staging_pendente INTEGER;
  volumetria_recente INTEGER;
BEGIN
  -- Contar uploads ativos
  SELECT COUNT(*) INTO uploads_ativos
  FROM processamento_uploads
  WHERE status IN ('processando', 'pendente', 'staging_concluido')
    AND created_at > now() - interval '2 hours';
  
  -- Contar staging pendente  
  SELECT COUNT(*) INTO staging_pendente
  FROM volumetria_staging
  WHERE status_processamento = 'pendente';
  
  -- Contar volumetria recente
  SELECT COUNT(*) INTO volumetria_recente
  FROM volumetria_mobilemed
  WHERE created_at > now() - interval '2 hours';
  
  resultado := jsonb_build_object(
    'sistema_status', 'operacional',
    'uploads_ativos', uploads_ativos,
    'staging_pendente', staging_pendente,
    'volumetria_recente', volumetria_recente,
    'timestamp_verificacao', now(),
    'recomendacao', CASE 
      WHEN uploads_ativos > 0 THEN 'Há uploads em processamento'
      WHEN staging_pendente > 0 THEN 'Há dados pendentes no staging'
      WHEN volumetria_recente = 0 THEN 'Sistema pronto para novos uploads'
      ELSE 'Sistema funcionando normalmente'
    END
  );
  
  RETURN resultado;
END;
$$;