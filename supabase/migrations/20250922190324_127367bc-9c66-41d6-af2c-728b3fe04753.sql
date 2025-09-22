-- Criar função para calcular volume total baseado na condição de volume
CREATE OR REPLACE FUNCTION public.calcular_volume_total(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_periodo text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cond_volume text;
  v_considera_plantao boolean := false;
  v_volume_total integer := 0;
BEGIN
  -- Buscar configurações do contrato do cliente
  SELECT cc.cond_volume, cc.considera_plantao
  INTO v_cond_volume, v_considera_plantao
  FROM contratos_clientes cc
  WHERE cc.cliente_id = p_cliente_id 
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  ORDER BY cc.created_at DESC
  LIMIT 1;

  -- Se não encontrou contrato, usar volume 1
  IF v_cond_volume IS NULL THEN
    RETURN 1;
  END IF;

  -- Calcular volume baseado na condição
  IF v_cond_volume = 'MOD' THEN
    -- Somar apenas por modalidade
    SELECT COALESCE(SUM(vm."VALORES"), 0)
    INTO v_volume_total
    FROM volumetria_mobilemed vm
    WHERE UPPER(TRIM(vm."EMPRESA")) = (
      SELECT UPPER(TRIM(c.nome_mobilemed))
      FROM clientes c 
      WHERE c.id = p_cliente_id
      LIMIT 1
    )
    AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
    AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
    AND (v_considera_plantao = true OR vm."PRIORIDADE" != 'PLANTÃO');

  ELSIF v_cond_volume = 'MOD/ESP' THEN
    -- Somar por modalidade + especialidade
    SELECT COALESCE(SUM(vm."VALORES"), 0)
    INTO v_volume_total
    FROM volumetria_mobilemed vm
    WHERE UPPER(TRIM(vm."EMPRESA")) = (
      SELECT UPPER(TRIM(c.nome_mobilemed))
      FROM clientes c 
      WHERE c.id = p_cliente_id
      LIMIT 1
    )
    AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
    AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
    AND (v_considera_plantao = true OR vm."PRIORIDADE" != 'PLANTÃO');

  ELSIF v_cond_volume = 'MOD/ESP/CAT' THEN
    -- Somar por modalidade + especialidade + categoria
    SELECT COALESCE(SUM(vm."VALORES"), 0)
    INTO v_volume_total
    FROM volumetria_mobilemed vm
    WHERE UPPER(TRIM(vm."EMPRESA")) = (
      SELECT UPPER(TRIM(c.nome_mobilemed))
      FROM clientes c 
      WHERE c.id = p_cliente_id
      LIMIT 1
    )
    AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
    AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')))
    AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
    AND (v_considera_plantao = true OR vm."PRIORIDADE" != 'PLANTÃO');

  ELSIF v_cond_volume = 'TOTAL' THEN
    -- Somar tudo, considerando plantão conforme configuração
    SELECT COALESCE(SUM(vm."VALORES"), 0)
    INTO v_volume_total
    FROM volumetria_mobilemed vm
    WHERE UPPER(TRIM(vm."EMPRESA")) = (
      SELECT UPPER(TRIM(c.nome_mobilemed))
      FROM clientes c 
      WHERE c.id = p_cliente_id
      LIMIT 1
    )
    AND (p_periodo IS NULL OR vm.periodo_referencia = p_periodo)
    AND (v_considera_plantao = true OR vm."PRIORIDADE" != 'PLANTÃO');

  ELSE
    -- Condição vazia ou desconhecida, usar volume 1
    v_volume_total := 1;
  END IF;

  -- Garantir que o volume seja pelo menos 1
  RETURN GREATEST(v_volume_total, 1);
END;
$function$;

-- Atualizar função calcular_preco_exame para usar os nomes corretos dos campos e a nova lógica de volume
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid, 
  p_modalidade text, 
  p_especialidade text, 
  p_categoria text DEFAULT 'SC'::text, 
  p_prioridade text DEFAULT 'ROTINA'::text, 
  p_volume_total integer DEFAULT NULL, 
  p_is_plantao boolean DEFAULT false,
  p_periodo text DEFAULT NULL
) RETURNS TABLE(valor_unitario numeric, faixa_volume text, detalhes_calculo jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preco RECORD;
  v_valor_final numeric := 0;
  v_faixa_aplicada text := 'N/A';
  v_detalhes jsonb := '{}';
  v_prioridade_busca text;
  v_volume_calculado integer;
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));
  
  -- Normalizar prioridades
  IF p_prioridade IN ('URGENTE','URGENCIA') THEN p_prioridade := 'URGÊNCIA'; END IF;
  IF p_prioridade = 'PLANTAO' THEN p_prioridade := 'PLANTÃO'; END IF;
  
  -- Determinar prioridade de busca (considerar plantão)
  v_prioridade_busca := p_prioridade;
  IF p_is_plantao AND p_prioridade = 'ROTINA' THEN
    v_prioridade_busca := 'PLANTÃO';
  END IF;

  -- Calcular volume total se não foi fornecido
  IF p_volume_total IS NULL THEN
    v_volume_calculado := calcular_volume_total(p_cliente_id, p_modalidade, p_especialidade, p_categoria, p_periodo);
  ELSE
    v_volume_calculado := p_volume_total;
  END IF;

  -- Buscar preço considerando volume inicial, volume final e condições
  SELECT ps.*, 
         CONCAT(COALESCE(ps.volume_inicial::text, '0'), '-', COALESCE(ps.volume_final::text, '∞')) as faixa_desc
  INTO v_preco
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = p_modalidade
    AND UPPER(TRIM(ps.especialidade)) = p_especialidade
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = v_prioridade_busca
    AND ps.ativo = true
    -- Validar faixas de volume usando os nomes corretos
    AND (ps.volume_inicial IS NULL OR v_volume_calculado >= COALESCE(ps.volume_inicial, 1))
    AND (ps.volume_final IS NULL OR v_volume_calculado <= COALESCE(ps.volume_final, 999999))
    -- Considerar plantão se configurado
    AND (ps.considera_prioridade_plantao = false OR (ps.considera_prioridade_plantao = true AND p_is_plantao))
  ORDER BY 
    -- Priorizar faixas mais específicas (menor range)
    COALESCE(ps.volume_final, 999999) - COALESCE(ps.volume_inicial, 1) ASC,
    ps.volume_inicial DESC,
    ps.updated_at DESC
  LIMIT 1;

  -- Se encontrou o preço
  IF FOUND THEN
    v_faixa_aplicada := v_preco.faixa_desc;
    
    -- Para URGÊNCIA, usar valor_urgencia se disponível, senão valor_base
    IF v_prioridade_busca = 'URGÊNCIA' THEN
      v_valor_final := COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0);
    -- Para PLANTÃO, verificar se considera_prioridade_plantao
    ELSIF v_prioridade_busca = 'PLANTÃO' THEN
      IF COALESCE(v_preco.considera_prioridade_plantao, false) THEN
        v_valor_final := COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0);
      ELSE
        v_valor_final := COALESCE(v_preco.valor_base, 0);
      END IF;
    -- Para ROTINA, usar valor_base
    ELSE
      v_valor_final := COALESCE(v_preco.valor_base, 0);
    END IF;

    -- Montar detalhes do cálculo
    v_detalhes := jsonb_build_object(
      'volume_calculado', v_volume_calculado,
      'volume_fornecido', p_volume_total,
      'faixa_aplicada', v_faixa_aplicada,
      'prioridade_busca', v_prioridade_busca,
      'considera_plantao', COALESCE(v_preco.considera_prioridade_plantao, false),
      'valor_base', v_preco.valor_base,
      'valor_urgencia', v_preco.valor_urgencia,
      'criterio_volume', (
        SELECT cc.cond_volume 
        FROM contratos_clientes cc 
        WHERE cc.cliente_id = p_cliente_id 
          AND cc.status = 'ativo' 
        ORDER BY cc.created_at DESC 
        LIMIT 1
      )
    );
  ELSE
    v_detalhes := jsonb_build_object(
      'volume_calculado', v_volume_calculado,
      'volume_fornecido', p_volume_total,
      'erro', 'Preço não encontrado para os critérios fornecidos'
    );
  END IF;

  RETURN QUERY SELECT 
    COALESCE(v_valor_final, 0),
    v_faixa_aplicada,
    v_detalhes;
END;
$function$;