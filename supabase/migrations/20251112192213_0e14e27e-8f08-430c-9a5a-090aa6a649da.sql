-- Dropar função existente com assinatura correta
DROP FUNCTION IF EXISTS calcular_preco_exame(uuid, text, text, text, text, text);

-- Recriar função com lógica correta de considera_prioridade_plantao
-- Se considera_prioridade_plantao = FALSE: exclui exames de PLANTÃO do cálculo de volume
-- Se considera_prioridade_plantao = TRUE: inclui exames de PLANTÃO no cálculo de volume
CREATE OR REPLACE FUNCTION calcular_preco_exame(
  p_cliente_id uuid, 
  p_modalidade text, 
  p_especialidade text, 
  p_categoria text,
  p_prioridade text,
  p_volume_total integer DEFAULT 0,
  p_cond_volume text DEFAULT 'MOD/ESP/CAT',
  p_periodo text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_volume_calculado integer := 0;
  v_considera_plantao boolean := true; -- Default: considera
  v_cond_volume_upper text;
  v_valor_final numeric := 0;
  v_nome_mobilemed text;
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'N/A')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));
  v_cond_volume_upper := UPPER(TRIM(COALESCE(p_cond_volume, 'MOD/ESP/CAT')));

  -- Buscar nome_mobilemed do cliente e se considera plantão
  SELECT c.nome_mobilemed, COALESCE(ps.considera_prioridade_plantao, true)
  INTO v_nome_mobilemed, v_considera_plantao
  FROM clientes c
  LEFT JOIN precos_servicos ps ON ps.cliente_id = c.id 
    AND ps.ativo = true
  WHERE c.id = p_cliente_id
  LIMIT 1;

  -- 1. CALCULAR VOLUME baseado na COND. VOLUME e CONSIDERA PLANTÃO
  CASE v_cond_volume_upper
    WHEN 'MOD' THEN
      -- Agrupa apenas por MODALIDADE
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    WHEN 'MOD/ESP' THEN
      -- Agrupa por MODALIDADE + ESPECIALIDADE
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = p_especialidade
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    WHEN 'MOD/ESP/CAT' THEN
      -- Agrupa por MODALIDADE + ESPECIALIDADE + CATEGORIA (padrão)
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = p_especialidade
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'N/A'))) = p_categoria
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    WHEN 'TOTAL' THEN
      -- Volume TOTAL de todos os exames do cliente
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    ELSE
      -- Condição não reconhecida, usar volume informado
      v_volume_calculado := p_volume_total;
  END CASE;

  -- Se não calculou volume, usar o informado
  IF v_volume_calculado = 0 THEN
    v_volume_calculado := p_volume_total;
  END IF;

  -- 2. BUSCAR PREÇO baseado no VOLUME CALCULADO
  -- Match 1: Modalidade + Especialidade + Categoria + Prioridade
  SELECT ps.valor_base
  INTO v_valor_final
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = p_modalidade
    AND UPPER(TRIM(ps.especialidade)) = p_especialidade
    AND UPPER(TRIM(COALESCE(ps.categoria, 'N/A'))) = p_categoria
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
    AND ps.ativo = true
    AND (ps.volume_inicial IS NULL OR v_volume_calculado >= ps.volume_inicial)
    AND (ps.volume_final IS NULL OR v_volume_calculado <= ps.volume_final)
  ORDER BY 
    ps.volume_inicial DESC NULLS LAST
  LIMIT 1;

  -- Fallback 1: Sem categoria específica
  IF v_valor_final IS NULL THEN
    SELECT ps.valor_base
    INTO v_valor_final
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
      AND ps.ativo = true
      AND (ps.volume_inicial IS NULL OR v_volume_calculado >= ps.volume_inicial)
      AND (ps.volume_final IS NULL OR v_volume_calculado <= ps.volume_final)
    ORDER BY 
      ps.volume_inicial DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Fallback 2: Sem prioridade específica (buscar ROTINA)
  IF v_valor_final IS NULL AND p_prioridade != 'ROTINA' THEN
    SELECT ps.valor_base
    INTO v_valor_final
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'N/A'))) = p_categoria
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = 'ROTINA'
      AND ps.ativo = true
      AND (ps.volume_inicial IS NULL OR v_volume_calculado >= ps.volume_inicial)
      AND (ps.volume_final IS NULL OR v_volume_calculado <= ps.volume_final)
    ORDER BY 
      ps.volume_inicial DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Fallback 3: Apenas modalidade
  IF v_valor_final IS NULL THEN
    SELECT ps.valor_base
    INTO v_valor_final
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND ps.ativo = true
      AND (ps.volume_inicial IS NULL OR v_volume_calculado >= ps.volume_inicial)
      AND (ps.volume_final IS NULL OR v_volume_calculado <= ps.volume_final)
    ORDER BY 
      ps.volume_inicial DESC NULLS LAST
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_valor_final, 0);
END;
$$;

COMMENT ON FUNCTION calcular_preco_exame IS 'Calcula preço do exame considerando COND. VOLUME e flag considera_prioridade_plantao para incluir/excluir exames de PLANTÃO do cálculo de volume';