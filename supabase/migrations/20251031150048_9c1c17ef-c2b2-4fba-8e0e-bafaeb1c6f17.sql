-- Atualizar função para buscar parâmetros de faturamento em contratos também
CREATE OR REPLACE FUNCTION public.calcular_faturamento_completo(
  p_cliente_id uuid,
  p_periodo text,
  p_volume_total integer DEFAULT 0
) RETURNS TABLE(
  valor_exames numeric,
  valor_franquia numeric,
  valor_portal_laudos numeric,
  valor_integracao numeric,
  valor_total numeric,
  detalhes_franquia jsonb,
  detalhes_calculo jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_parametros RECORD;
  v_valor_exames numeric := 0;
  v_valor_franquia numeric := 0;
  v_valor_portal numeric := 0;
  v_valor_integracao numeric := 0;
  v_detalhes_franquia jsonb := '{}';
  v_detalhes_calculo jsonb := '{}';
  v_fonte_parametros text := '';
BEGIN
  -- 1. Buscar parâmetros de faturamento do cliente
  SELECT 
    pf.aplicar_franquia as param_aplicar_franquia,
    pf.valor_franquia as param_valor_franquia,
    pf.volume_franquia as param_volume_franquia,
    pf.frequencia_continua as param_frequencia_continua,
    pf.frequencia_por_volume as param_frequencia_por_volume,
    pf.valor_acima_franquia as param_valor_acima_franquia,
    pf.valor_integracao as param_valor_integracao,
    pf.portal_laudos as param_portal_laudos,
    pf.cobrar_integracao as param_cobrar_integracao,
    'parametros_faturamento' as fonte
  INTO v_parametros
  FROM parametros_faturamento pf
  WHERE pf.cliente_id = p_cliente_id
    AND pf.status = 'A'
  ORDER BY pf.updated_at DESC
  LIMIT 1;

  -- 2. Se não encontrou em parametros_faturamento, buscar no contrato
  IF NOT FOUND THEN
    SELECT 
      COALESCE((cc.configuracoes_franquia->>'aplicar_franquia')::boolean, cc.tipo_cliente = 'CO') as param_aplicar_franquia,
      COALESCE((cc.configuracoes_franquia->>'valor_franquia')::numeric, 0) as param_valor_franquia,
      COALESCE((cc.configuracoes_franquia->>'volume_franquia')::integer, 0) as param_volume_franquia,
      COALESCE((cc.configuracoes_franquia->>'frequencia_continua')::boolean, false) as param_frequencia_continua,
      COALESCE((cc.configuracoes_franquia->>'frequencia_por_volume')::boolean, false) as param_frequencia_por_volume,
      COALESCE((cc.configuracoes_franquia->>'valor_acima_franquia')::numeric, 0) as param_valor_acima_franquia,
      COALESCE((cc.configuracoes_integracao->>'valor_integracao')::numeric, 0) as param_valor_integracao,
      COALESCE((cc.configuracoes_integracao->>'portal_laudos')::boolean, false) as param_portal_laudos,
      COALESCE((cc.configuracoes_integracao->>'cobrar_integracao')::boolean, false) as param_cobrar_integracao,
      'contratos_clientes' as fonte
    INTO v_parametros
    FROM contratos_clientes cc
    WHERE cc.cliente_id = p_cliente_id
      AND cc.status = 'ativo'
      AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
    ORDER BY cc.data_inicio DESC
    LIMIT 1;
  END IF;

  v_fonte_parametros := COALESCE(v_parametros.fonte, 'padroes');

  -- 3. Se ainda não encontrou, usar valores padrão
  IF v_parametros IS NULL THEN
    v_parametros.param_aplicar_franquia := false;
    v_parametros.param_valor_franquia := 0;
    v_parametros.param_volume_franquia := 0;
    v_parametros.param_frequencia_continua := false;
    v_parametros.param_frequencia_por_volume := false;
    v_parametros.param_valor_acima_franquia := 0;
    v_parametros.param_valor_integracao := 0;
    v_parametros.param_portal_laudos := false;
    v_parametros.param_cobrar_integracao := false;
  END IF;

  -- Calcular franquia
  IF v_parametros.param_aplicar_franquia THEN
    IF v_parametros.param_frequencia_continua THEN
      IF v_parametros.param_frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.param_volume_franquia, 0) THEN
        v_valor_franquia := COALESCE(v_parametros.param_valor_acima_franquia, v_parametros.param_valor_franquia, 0);
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'continua_com_volume',
          'volume_base', v_parametros.param_volume_franquia,
          'volume_atual', p_volume_total,
          'valor_aplicado', v_valor_franquia,
          'motivo', 'Frequência contínua + volume acima da franquia',
          'fonte', v_fonte_parametros
        );
      ELSE
        v_valor_franquia := COALESCE(v_parametros.param_valor_franquia, 0);
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'continua_normal',
          'volume_atual', p_volume_total,
          'valor_aplicado', v_valor_franquia,
          'motivo', 'Frequência contínua - valor base',
          'fonte', v_fonte_parametros
        );
      END IF;
    ELSE
      IF p_volume_total > 0 THEN
        IF v_parametros.param_frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.param_volume_franquia, 0) THEN
          v_valor_franquia := COALESCE(v_parametros.param_valor_acima_franquia, v_parametros.param_valor_franquia, 0);
          v_detalhes_franquia := jsonb_build_object(
            'tipo', 'volume_acima',
            'volume_base', v_parametros.param_volume_franquia,
            'volume_atual', p_volume_total,
            'valor_aplicado', v_valor_franquia,
            'motivo', 'Volume acima da franquia',
            'fonte', v_fonte_parametros
          );
        ELSE
          v_valor_franquia := COALESCE(v_parametros.param_valor_franquia, 0);
          v_detalhes_franquia := jsonb_build_object(
            'tipo', 'volume_normal',
            'volume_atual', p_volume_total,
            'valor_aplicado', v_valor_franquia,
            'motivo', 'Volume dentro da franquia',
            'fonte', v_fonte_parametros
          );
        END IF;
      ELSE
        v_valor_franquia := 0;
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'sem_volume',
          'volume_atual', 0,
          'valor_aplicado', 0,
          'motivo', 'Sem volume de exames - franquia não aplicada',
          'fonte', v_fonte_parametros
        );
      END IF;
    END IF;
  ELSE
    v_detalhes_franquia := jsonb_build_object(
      'tipo', 'nao_aplica',
      'valor_aplicado', 0,
      'motivo', 'Cliente não possui franquia configurada',
      'fonte', v_fonte_parametros
    );
  END IF;

  -- Calcular Portal de Laudos
  IF v_parametros.param_portal_laudos THEN
    v_valor_portal := COALESCE(v_parametros.param_valor_integracao, 0);
  END IF;

  -- Calcular Integração
  IF v_parametros.param_cobrar_integracao THEN
    v_valor_integracao := COALESCE(v_parametros.param_valor_integracao, 0);
  END IF;

  -- Montar detalhes do cálculo
  v_detalhes_calculo := jsonb_build_object(
    'periodo', p_periodo,
    'volume_total', p_volume_total,
    'fonte_parametros', v_fonte_parametros,
    'parametros_aplicados', jsonb_build_object(
      'tem_franquia', v_parametros.param_aplicar_franquia,
      'tem_portal', v_parametros.param_portal_laudos,
      'tem_integracao', v_parametros.param_cobrar_integracao,
      'freq_continua', v_parametros.param_frequencia_continua,
      'freq_por_volume', v_parametros.param_frequencia_por_volume
    )
  );

  RETURN QUERY SELECT 
    v_valor_exames,
    v_valor_franquia,
    v_valor_portal,
    v_valor_integracao,
    v_valor_exames + v_valor_franquia + v_valor_portal + v_valor_integracao,
    v_detalhes_franquia,
    v_detalhes_calculo;
END;
$$;