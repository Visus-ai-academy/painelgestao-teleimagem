-- Corrigir função aplicar_valores_de_para para comparação case-insensitive
CREATE OR REPLACE FUNCTION public.aplicar_valores_de_para()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_processados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar valores de referência nos dados com VALORES zerados ou nulos
  -- USANDO COMPARAÇÃO CASE-INSENSITIVE com UPPER()
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE UPPER(vm."ESTUDO_DESCRICAO") = UPPER(vr.estudo_descricao)
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte IN ('volumetria_fora_padrao', 'fora_padrao');
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Contar total de registros ainda zerados após a aplicação
  SELECT COUNT(*) INTO registros_processados
  FROM volumetria_mobilemed vm
  WHERE (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte IN ('volumetria_fora_padrao', 'fora_padrao');
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para_case_insensitive', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'registros_ainda_zerados', registros_processados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  -- Retornar resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'registros_ainda_zerados', registros_processados,
    'data_processamento', now(),
    'observacao', 'Comparação case-insensitive aplicada - UPPER()'
  );
  
  RETURN resultado;
END;
$function$;