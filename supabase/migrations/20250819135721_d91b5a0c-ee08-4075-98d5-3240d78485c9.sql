-- Função para limpar uploads travados
CREATE OR REPLACE FUNCTION public.limpar_uploads_travados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uploads_corrigidos INTEGER := 0;
BEGIN
  -- Marcar uploads antigos como erro
  UPDATE processamento_uploads 
  SET 
    status = 'erro',
    detalhes_erro = jsonb_build_object(
      'etapa', 'timeout',
      'motivo', 'Upload travado por mais de 10 minutos',
      'corrigido_em', now()
    ),
    completed_at = now()
  WHERE status IN ('processando', 'pendente') 
    AND created_at < now() - interval '10 minutes';
  
  GET DIAGNOSTICS uploads_corrigidos = ROW_COUNT;
  
  -- Limpar staging órfão
  DELETE FROM volumetria_staging 
  WHERE created_at < now() - interval '30 minutes'
    AND status_processamento = 'pendente';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Uploads travados limpos com sucesso',
    'uploads_corrigidos', uploads_corrigidos
  );
END;
$$;