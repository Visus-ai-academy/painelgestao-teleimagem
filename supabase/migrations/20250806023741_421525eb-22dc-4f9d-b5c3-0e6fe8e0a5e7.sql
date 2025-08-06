-- Função para sincronizar preços com serviços contratados dos contratos
CREATE OR REPLACE FUNCTION public.sincronizar_precos_servicos_contratos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  contratos_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Atualizar serviços contratados com base nos preços de cada cliente
  UPDATE contratos_clientes cc
  SET servicos_contratados = (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ps.id,
          'modalidade', ps.modalidade,
          'especialidade', ps.especialidade,
          'categoria', ps.categoria,
          'prioridade', ps.prioridade,
          'valor', ps.valor_base,
          'volume_inicial', ps.volume_inicial,
          'volume_final', ps.volume_final,
          'volume_total', ps.volume_total,
          'considera_plantao', ps.considera_prioridade_plantao,
          'ativo', ps.ativo
        )
      ),
      '[]'::jsonb
    )
    FROM precos_servicos ps
    WHERE ps.cliente_id = cc.cliente_id
      AND ps.ativo = true
  ),
  updated_at = now()
  WHERE EXISTS (
    SELECT 1 FROM precos_servicos ps2 
    WHERE ps2.cliente_id = cc.cliente_id 
      AND ps2.ativo = true
  );
  
  GET DIAGNOSTICS contratos_atualizados = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('contratos_clientes', 'UPDATE', 'sincronizar_precos', 
          jsonb_build_object('contratos_atualizados', contratos_atualizados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'contratos_atualizados', contratos_atualizados,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;