-- Atualizar função para refresh da view materializada
CREATE OR REPLACE FUNCTION public.aplicar_de_para_prioridade()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar De-Para Prioridade nos dados de volumetria
  UPDATE volumetria_mobilemed vm
  SET "PRIORIDADE" = vp.nome_final,
      updated_at = now()
  FROM valores_prioridade_de_para vp
  WHERE vm."PRIORIDADE" = vp.prioridade_original
    AND vp.ativo = true;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Atualizar a view materializada (sem CONCURRENTLY para evitar erro)
  REFRESH MATERIALIZED VIEW mv_volumetria_dashboard;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para_prioridade', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'view_atualizada', true),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'view_atualizada', true,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;