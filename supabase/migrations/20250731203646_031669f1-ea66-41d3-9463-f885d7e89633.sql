-- Aplicar de-para para registros sem valor automaticamente após upload
CREATE OR REPLACE FUNCTION aplicar_de_para_automatico(arquivo_fonte_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar valores de referência nos dados com VALORES zerados ou nulos do arquivo específico
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE vm."ESTUDO_DESCRICAO" = vr.estudo_descricao
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte = arquivo_fonte_param;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'de_para_automatico', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'arquivo_fonte', arquivo_fonte_param),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  -- Retornar resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'arquivo_fonte', arquivo_fonte_param,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;