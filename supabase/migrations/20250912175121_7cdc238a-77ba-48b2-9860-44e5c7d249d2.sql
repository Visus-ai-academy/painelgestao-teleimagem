-- Corrigir função para usar operação válida no audit_logs
CREATE OR REPLACE FUNCTION sincronizar_parametros_completos_contratos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_atualizados INTEGER := 0;
  resultado jsonb;
BEGIN
  -- Atualizar contratos com todos os dados dos parâmetros
  UPDATE contratos_clientes cc
  SET 
    tipo_faturamento = COALESCE(pf.tipo_faturamento, cc.tipo_faturamento),
    tipo_cliente = COALESCE(pf.tipo_cliente, cc.tipo_cliente),
    dia_fechamento = COALESCE(pf.dia_fechamento, cc.dia_fechamento),
    periodicidade_reajuste = COALESCE(pf.periodicidade_reajuste, cc.periodicidade_reajuste),
    indice_reajuste = COALESCE(pf.indice_reajuste, cc.indice_reajuste),
    percentual_reajuste_fixo = COALESCE(pf.percentual_reajuste_fixo, cc.percentual_reajuste_fixo),
    data_aniversario_contrato = COALESCE(pf.data_aniversario_contrato, cc.data_aniversario_contrato),
    impostos_ab_min = COALESCE(pf.impostos_ab_min, cc.impostos_ab_min),
    percentual_iss = COALESCE(pf.percentual_iss, cc.percentual_iss),
    simples = COALESCE(pf.simples, cc.simples),
    considera_plantao = COALESCE(pf.cobrar_urgencia_como_rotina, cc.considera_plantao),
    -- Adicionar configurações de franquia
    configuracoes_franquia = jsonb_build_object(
      'aplicar_franquia', COALESCE(pf.aplicar_franquia, false),
      'valor_franquia', COALESCE(pf.valor_franquia, 0),
      'volume_franquia', COALESCE(pf.volume_franquia, 0),
      'frequencia_continua', COALESCE(pf.frequencia_continua, false),
      'frequencia_por_volume', COALESCE(pf.frequencia_por_volume, false),
      'valor_acima_franquia', COALESCE(pf.valor_acima_franquia, 0)
    ),
    -- Adicionar configurações de integração
    configuracoes_integracao = jsonb_build_object(
      'valor_integracao', COALESCE(pf.valor_integracao, 0),
      'cobrar_integracao', COALESCE(pf.cobrar_integracao, false),
      'portal_laudos', COALESCE(pf.portal_laudos, false),
      'data_inicio_integracao', pf.data_inicio_integracao,
      'incluir_empresa_origem', COALESCE(pf.incluir_empresa_origem, false),
      'incluir_access_number', COALESCE(pf.incluir_access_number, false),
      'incluir_medico_solicitante', COALESCE(pf.incluir_medico_solicitante, false)
    ),
    -- Marcar como tendo parâmetros configurados
    tem_parametros_configurados = true,
    updated_at = now()
  FROM parametros_faturamento pf
  WHERE cc.cliente_id = pf.cliente_id
    AND pf.status = 'A';

  GET DIAGNOSTICS total_atualizados = ROW_COUNT;

  -- Log da operação usando UPDATE (operação válida)
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('contratos_clientes', 'UPDATE', 'bulk', 
          jsonb_build_object('contratos_atualizados', total_atualizados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  resultado := jsonb_build_object(
    'sucesso', true,
    'contratos_atualizados', total_atualizados,
    'timestamp', now()
  );

  RETURN resultado;
END;
$function$;