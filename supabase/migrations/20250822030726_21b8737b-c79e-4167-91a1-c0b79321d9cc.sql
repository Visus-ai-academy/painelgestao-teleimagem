-- Function para reprocessar registros rejeitados de uploads existentes
CREATE OR REPLACE FUNCTION public.reprocessar_rejeicoes_upload(upload_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  upload_info RECORD;
  total_inserido INTEGER := 0;
BEGIN
  -- Buscar informações do upload
  SELECT * INTO upload_info
  FROM processamento_uploads
  WHERE id = upload_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Upload não encontrado'
    );
  END IF;
  
  -- Verificar se há registros de erro para processar
  IF COALESCE(upload_info.registros_erro, 0) = 0 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Nenhum registro de erro encontrado neste upload'
    );
  END IF;
  
  -- Criar registros rejeitados genéricos baseados no contador
  INSERT INTO registros_rejeitados_processamento (
    arquivo_fonte,
    lote_upload, 
    linha_original,
    dados_originais,
    motivo_rejeicao,
    detalhes_erro,
    created_at
  )
  SELECT 
    upload_info.tipo_arquivo,
    COALESCE(upload_info.detalhes_erro->>'lote_upload', 'unknown'),
    generate_series(1, upload_info.registros_erro),
    jsonb_build_object(
      'ARQUIVO_FONTE', upload_info.tipo_arquivo,
      'PERIODO_REFERENCIA', upload_info.periodo_referencia,
      'OBSERVACAO', 'Registro rejeitado - detalhes não disponíveis (reprocessamento)'
    ),
    'REJEICAO_REPROCESSAMENTO',
    format('Registro rejeitado durante processamento original do arquivo %s em %s. Total de %s registros rejeitados.', 
           upload_info.arquivo_nome, 
           upload_info.created_at::date, 
           upload_info.registros_erro),
    NOW()
  WHERE NOT EXISTS (
    -- Evitar duplicatas
    SELECT 1 FROM registros_rejeitados_processamento rrp
    WHERE rrp.lote_upload = COALESCE(upload_info.detalhes_erro->>'lote_upload', 'unknown')
  );
  
  GET DIAGNOSTICS total_inserido = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'upload_id', upload_id_param,
    'arquivo', upload_info.arquivo_nome,
    'registros_erro_original', upload_info.registros_erro,
    'registros_inseridos', total_inserido,
    'lote_upload', COALESCE(upload_info.detalhes_erro->>'lote_upload', 'unknown')
  );
END;
$$;