-- Corrigir função calcular_preco_exame para implementar todas as variações de Cond. Volume
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_categoria text DEFAULT 'SC',
  p_prioridade text DEFAULT 'ROTINA',
  p_volume_total integer DEFAULT 1,
  p_periodo text DEFAULT NULL
) RETURNS TABLE(
  valor_unitario numeric,
  faixa_volume text,
  detalhes_calculo jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_preco RECORD;
  v_volume_calculado integer := 0;
  v_considera_plantao boolean := false;
  v_cond_volume text;
  v_detalhes jsonb := '{}';
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));

  -- 1. Buscar preço específico com todas as condições
  SELECT ps.*, ps.cond_volume, ps.considera_plantao
  INTO v_preco
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = p_modalidade
    AND UPPER(TRIM(ps.especialidade)) = p_especialidade
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
    AND ps.ativo = true
    AND (p_volume_total >= COALESCE(ps.volume_inicial, 1))
    AND (p_volume_total <= COALESCE(ps.volume_final, 999999))
  ORDER BY 
    ps.volume_inicial DESC,
    ps.updated_at DESC
  LIMIT 1;

  -- Se não encontrou preço específico, tentar com categoria SC
  IF NOT FOUND AND p_categoria != 'SC' THEN
    SELECT ps.*, ps.cond_volume, ps.considera_plantao
    INTO v_preco
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = 'SC'
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
      AND ps.ativo = true
      AND (p_volume_total >= COALESCE(ps.volume_inicial, 1))
      AND (p_volume_total <= COALESCE(ps.volume_final, 999999))
    ORDER BY 
      ps.volume_inicial DESC,
      ps.updated_at DESC
    LIMIT 1;
  END IF;

  -- Se ainda não encontrou, tentar prioridade ROTINA
  IF NOT FOUND AND p_prioridade != 'ROTINA' THEN
    SELECT ps.*, ps.cond_volume, ps.considera_plantao
    INTO v_preco
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = COALESCE(p_categoria, 'SC')
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = 'ROTINA'
      AND ps.ativo = true
      AND (p_volume_total >= COALESCE(ps.volume_inicial, 1))
      AND (p_volume_total <= COALESCE(ps.volume_final, 999999))
    ORDER BY 
      ps.volume_inicial DESC,
      ps.updated_at DESC
    LIMIT 1;
  END IF;

  -- Se não encontrou nenhum preço, retornar 0
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      0::numeric as valor_unitario,
      'SEM_PRECO'::text as faixa_volume,
      jsonb_build_object(
        'erro', 'Preço não encontrado',
        'modalidade', p_modalidade,
        'especialidade', p_especialidade,
        'categoria', p_categoria,
        'prioridade', p_prioridade,
        'volume', p_volume_total
      ) as detalhes_calculo;
    RETURN;
  END IF;

  -- 2. Aplicar lógica de Cond. Volume se configurada
  v_cond_volume := UPPER(TRIM(COALESCE(v_preco.cond_volume, '')));
  v_considera_plantao := COALESCE(v_preco.considera_plantao, false);

  -- Calcular volume baseado na Cond. Volume
  IF v_cond_volume IS NOT NULL AND v_cond_volume != '' THEN
    CASE v_cond_volume
      WHEN 'MOD' THEN
        -- Agrupa apenas por modalidade
        SELECT COALESCE(SUM(vm."VALORES"), 0)::integer
        INTO v_volume_calculado
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = (
          SELECT UPPER(TRIM(c.nome_mobilemed)) 
          FROM clientes c 
          WHERE c.id = p_cliente_id
        )
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND (
          v_considera_plantao = true 
          OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO'
        )
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo);

      WHEN 'MOD/ESP' THEN
        -- Agrupa por modalidade + especialidade
        SELECT COALESCE(SUM(vm."VALORES"), 0)::integer
        INTO v_volume_calculado
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = (
          SELECT UPPER(TRIM(c.nome_mobilemed)) 
          FROM clientes c 
          WHERE c.id = p_cliente_id
        )
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = p_especialidade
        AND (
          v_considera_plantao = true 
          OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO'
        )
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo);

      WHEN 'MOD/ESP/CAT' THEN
        -- Agrupa por modalidade + especialidade + categoria
        SELECT COALESCE(SUM(vm."VALORES"), 0)::integer
        INTO v_volume_calculado
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = (
          SELECT UPPER(TRIM(c.nome_mobilemed)) 
          FROM clientes c 
          WHERE c.id = p_cliente_id
        )
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = p_especialidade
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = p_categoria
        AND (
          v_considera_plantao = true 
          OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO'
        )
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo);

      WHEN 'TOTAL' THEN
        -- Volume total de todos os exames
        SELECT COALESCE(SUM(vm."VALORES"), 0)::integer
        INTO v_volume_calculado
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = (
          SELECT UPPER(TRIM(c.nome_mobilemed)) 
          FROM clientes c 
          WHERE c.id = p_cliente_id
        )
        AND (
          v_considera_plantao = true 
          OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO'
        )
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo);

      ELSE
        -- Condição não reconhecida, usar volume padrão
        v_volume_calculado := p_volume_total;
    END CASE;

    -- Buscar preço correto baseado no volume calculado
    SELECT ps.*
    INTO v_preco
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
      AND ps.ativo = true
      AND (v_volume_calculado >= COALESCE(ps.volume_inicial, 1))
      AND (v_volume_calculado <= COALESCE(ps.volume_final, 999999))
    ORDER BY 
      ps.volume_inicial DESC,
      ps.updated_at DESC
    LIMIT 1;
  ELSE
    -- Sem Cond. Volume, usar volume informado
    v_volume_calculado := p_volume_total;
  END IF;

  -- Montar detalhes do cálculo
  v_detalhes := jsonb_build_object(
    'cliente_id', p_cliente_id,
    'modalidade', p_modalidade,
    'especialidade', p_especialidade,
    'categoria', p_categoria,
    'prioridade', p_prioridade,
    'volume_informado', p_volume_total,
    'cond_volume', v_cond_volume,
    'volume_calculado', v_volume_calculado,
    'considera_plantao', v_considera_plantao,
    'preco_id', v_preco.id,
    'faixa_volume_inicial', v_preco.volume_inicial,
    'faixa_volume_final', v_preco.volume_final
  );

  -- Retornar resultado
  RETURN QUERY SELECT 
    COALESCE(v_preco.valor_base, 0)::numeric as valor_unitario,
    CONCAT(
      COALESCE(v_preco.volume_inicial, 1)::text,
      '-',
      COALESCE(v_preco.volume_final, 999999)::text
    )::text as faixa_volume,
    v_detalhes as detalhes_calculo;
END;
$$;