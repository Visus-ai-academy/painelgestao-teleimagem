
-- Atualizar função calcular_preco_exame para busca EXATA (sem fallbacks)
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid, 
  p_modalidade text, 
  p_especialidade text, 
  p_categoria text, 
  p_prioridade text, 
  p_volume_total integer DEFAULT 0, 
  p_cond_volume text DEFAULT 'MOD/ESP/CAT'::text, 
  p_periodo text DEFAULT NULL::text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_volume_calculado integer := 0;
  v_considera_plantao boolean := true;
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

  -- Calcular volume baseado na COND. VOLUME
  CASE v_cond_volume_upper
    WHEN 'MOD' THEN
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    WHEN 'MOD/ESP' THEN
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND UPPER(TRIM(vm."MODALIDADE")) = p_modalidade
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = p_especialidade
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    WHEN 'MOD/ESP/CAT' THEN
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
      SELECT COALESCE(SUM(CAST(vm."VALORES" AS integer)), 0)
      INTO v_volume_calculado
      FROM volumetria_mobilemed vm
      WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM(v_nome_mobilemed))
        AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
        AND (v_considera_plantao = true OR UPPER(TRIM(vm."PRIORIDADE")) != 'PLANTÃO');

    ELSE
      v_volume_calculado := p_volume_total;
  END CASE;

  IF v_volume_calculado = 0 THEN
    v_volume_calculado := p_volume_total;
  END IF;

  -- BUSCA EXATA: Modalidade + Especialidade + Categoria + Prioridade
  -- SEM FALLBACKS - Se não encontrar, retorna 0
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

  -- Retorna o valor encontrado ou 0 (sem fallbacks)
  RETURN COALESCE(v_valor_final, 0);
END;
$function$;

COMMENT ON FUNCTION public.calcular_preco_exame IS 'Busca preço EXATO por Modalidade+Especialidade+Categoria+Prioridade. Sem fallbacks - retorna 0 se não encontrar.';
