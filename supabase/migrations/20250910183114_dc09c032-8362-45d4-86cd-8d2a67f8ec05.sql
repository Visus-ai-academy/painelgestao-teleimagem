-- Criar função para calcular faturamento completo incluindo franquias (sem log de auditoria problemático)
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
  -- Buscar parâmetros de faturamento do cliente
  SELECT 
    aplicar_franquia,
    valor_franquia,
    volume_franquia,
    frequencia_continua,
    frequencia_por_volume,
    valor_acima_franquia,
    valor_integracao,
    portal_laudos,
    cobrar_integracao
  INTO v_parametros
  FROM parametros_faturamento pf
  WHERE pf.cliente_id = p_cliente_id
    AND pf.status = 'A' -- Apenas parâmetros ativos
  ORDER BY pf.updated_at DESC
  LIMIT 1;

  -- Se não encontrou parâmetros, busca valores zerados
  IF NOT FOUND THEN
    v_parametros.aplicar_franquia := false;
    v_parametros.valor_franquia := 0;
    v_parametros.volume_franquia := 0;
    v_parametros.frequencia_continua := false;
    v_parametros.frequencia_por_volume := false;
    v_parametros.valor_acima_franquia := 0;
    v_parametros.valor_integracao := 0;
    v_parametros.portal_laudos := false;
    v_parametros.cobrar_integracao := false;
  END IF;

  -- Calcular franquia
  IF v_parametros.aplicar_franquia THEN
    -- Se frequência contínua = SIM, sempre cobra franquia
    IF v_parametros.frequencia_continua THEN
      IF v_parametros.frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.volume_franquia, 0) THEN
        -- Volume acima da franquia
        v_valor_franquia := COALESCE(v_parametros.valor_acima_franquia, v_parametros.valor_franquia, 0);
        v_detalhes_franquia := jsonb_build_object(
          'tipo', 'continua_com_volume',
          'volume_base', v_parametros.volume_franquia,
          'volume_atual', p_volume_total,
          'valor_aplicado', v_valor_franquia,
          'motivo', 'Frequência contínua + volume acima da franquia'
        );
      ELSE
        -- Volume dentro da franquia ou não aplica por volume
        v_valor_franquia := COALESCE(v_parametros.valor_franquia, 0);
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
        IF v_parametros.frequencia_por_volume AND p_volume_total > COALESCE(v_parametros.volume_franquia, 0) THEN
          -- Volume acima da franquia
          v_valor_franquia := COALESCE(v_parametros.valor_acima_franquia, v_parametros.valor_franquia, 0);
          v_detalhes_franquia := jsonb_build_object(
            'tipo', 'volume_acima',
            'volume_base', v_parametros.volume_franquia,
            'volume_atual', p_volume_total,
            'valor_aplicado', v_valor_franquia,
            'motivo', 'Volume acima da franquia'
          );
        ELSE
          -- Volume dentro da franquia
          v_valor_franquia := COALESCE(v_parametros.valor_franquia, 0);
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
  IF v_parametros.portal_laudos THEN
    v_valor_portal := COALESCE(
      (SELECT valor_integracao FROM parametros_faturamento 
       WHERE cliente_id = p_cliente_id 
       ORDER BY updated_at DESC LIMIT 1), 
      0
    );
  END IF;

  -- Calcular Integração
  IF v_parametros.cobrar_integracao THEN
    v_valor_integracao := COALESCE(v_parametros.valor_integracao, 0);
  END IF;

  -- Montar detalhes do cálculo
  v_detalhes_calculo := jsonb_build_object(
    'periodo', p_periodo,
    'volume_total', p_volume_total,
    'parametros_aplicados', jsonb_build_object(
      'tem_franquia', v_parametros.aplicar_franquia,
      'tem_portal', v_parametros.portal_laudos,
      'tem_integracao', v_parametros.cobrar_integracao,
      'freq_continua', v_parametros.frequencia_continua,
      'freq_por_volume', v_parametros.frequencia_por_volume
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

-- Sincronizar parâmetros de faturamento para contratos (sem log problemático)
CREATE OR REPLACE FUNCTION public.sincronizar_parametros_para_contratos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_atualizados integer := 0;
  v_parametro RECORD;
BEGIN
  -- Para cada parâmetro ativo, atualizar o contrato correspondente
  FOR v_parametro IN 
    SELECT DISTINCT ON (cliente_id)
      cliente_id,
      aplicar_franquia,
      valor_franquia,
      volume_franquia,
      frequencia_continua,
      frequencia_por_volume,
      valor_acima_franquia,
      valor_integracao,
      cobrar_integracao,
      portal_laudos
    FROM parametros_faturamento 
    WHERE status = 'A'
    ORDER BY cliente_id, updated_at DESC
  LOOP
    -- Atualizar contrato com configurações de franquia e integração
    UPDATE contratos_clientes 
    SET 
      configuracoes_franquia = jsonb_build_object(
        'tem_franquia', v_parametro.aplicar_franquia,
        'valor_franquia', COALESCE(v_parametro.valor_franquia, 0),
        'volume_franquia', COALESCE(v_parametro.volume_franquia, 0),
        'frequencia_continua', COALESCE(v_parametro.frequencia_continua, false),
        'frequencia_por_volume', COALESCE(v_parametro.frequencia_por_volume, false),
        'valor_acima_franquia', COALESCE(v_parametro.valor_acima_franquia, 0)
      ),
      configuracoes_integracao = jsonb_build_object(
        'cobra_integracao', COALESCE(v_parametro.cobrar_integracao, false),
        'valor_integracao', COALESCE(v_parametro.valor_integracao, 0),
        'portal_laudos', COALESCE(v_parametro.portal_laudos, false)
      ),
      tem_parametros_configurados = true,
      updated_at = now()
    WHERE cliente_id = v_parametro.cliente_id
      AND status = 'ativo';
    
    IF FOUND THEN
      v_atualizados := v_atualizados + 1;
    END IF;
  END LOOP;

  RETURN v_atualizados;
END;
$$;

-- Executar sincronização inicial
SELECT sincronizar_parametros_para_contratos();