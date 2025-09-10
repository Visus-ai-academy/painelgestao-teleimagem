-- Corrigir função para evitar conflitos de nomes de colunas
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
BEGIN
  -- Buscar parâmetros de faturamento do cliente com aliases para evitar conflitos
  SELECT 
    pf.aplicar_franquia as param_aplicar_franquia,
    pf.valor_franquia as param_valor_franquia,
    pf.volume_franquia as param_volume_franquia,
    pf.frequencia_continua as param_frequencia_continua,
    pf.frequencia_por_volume as param_frequencia_por_volume,
    pf.valor_acima_franquia as param_valor_acima_franquia,
    pf.valor_integracao as param_valor_integracao,
    pf.portal_laudos as param_portal_laudos,
    pf.cobrar_integracao as param_cobrar_integracao
  INTO v_parametros
  FROM parametros_faturamento pf
  WHERE pf.cliente_id = p_cliente_id
    AND pf.status = 'A'
  ORDER BY pf.updated_at DESC
  LIMIT 1;

  -- Se não encontrou parâmetros, usar valores padrão
  IF NOT FOUND THEN
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

  -- Calcular franquia usando as variáveis com prefixo param_
  IF v_parametros.param_aplicar_franquia THEN
    -- Se frequência contínua = SIM, sempre cobra franquia
    IF v_parametros.param_frequencia_continua THEN
      IF v_parametros.param_frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.param_volume_franquia, 0) THEN
        -- Volume acima da franquia
        v_valor_franquia := COALESCE(v_parametros.param_valor_acima_franquia, v_parametros.param_valor_franquia, 0);
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'continua_com_volume',
          'volume_base', v_parametros.param_volume_franquia,
          'volume_atual', p_volume_total,
          'valor_aplicado', v_valor_franquia,
          'motivo', 'Frequência contínua + volume acima da franquia'
        );
      ELSE
        -- Volume dentro da franquia ou não aplica por volume
        v_valor_franquia := COALESCE(v_parametros.param_valor_franquia, 0);
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'continua_normal',
          'volume_atual', p_volume_total,
          'valor_aplicado', v_valor_franquia,
          'motivo', 'Frequência contínua - valor base'
        );
      END IF;
    ELSE
      -- Frequência contínua = NÃO, só cobra se houver volume
      IF p_volume_total > 0 THEN
        IF v_parametros.param_frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.param_volume_franquia, 0) THEN
          -- Volume acima da franquia
          v_valor_franquia := COALESCE(v_parametros.param_valor_acima_franquia, v_parametros.param_valor_franquia, 0);
          v_detalhes_franquia := jsonb_build_object(
            'tipo', 'volume_acima',
            'volume_base', v_parametros.param_volume_franquia,
            'volume_atual', p_volume_total,
            'valor_aplicado', v_valor_franquia,
            'motivo', 'Volume acima da franquia'
          );
        ELSE
          -- Volume dentro da franquia
          v_valor_franquia := COALESCE(v_parametros.param_valor_franquia, 0);
          v_detalhes_franquia := jsonb_build_object(
            'tipo', 'volume_normal',
            'volume_atual', p_volume_total,
            'valor_aplicado', v_valor_franquia,
            'motivo', 'Volume dentro da franquia'
          );
        END IF;
      ELSE
        -- Sem volume, não cobra franquia
        v_valor_franquia := 0;
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'sem_volume',
          'volume_atual', 0,
          'valor_aplicado', 0,
          'motivo', 'Sem volume de exames - franquia não aplicada'
        );
      END IF;
    END IF;
  ELSE
    v_detalhes_franquia := jsonb_build_object(
      'tipo', 'nao_aplica',
      'valor_aplicado', 0,
      'motivo', 'Cliente não possui franquia configurada'
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