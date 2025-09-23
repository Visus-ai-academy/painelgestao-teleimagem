-- Corrigir a lógica de cálculo de preço para usar cond_volume específico da linha de preço
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id UUID,
  p_modalidade TEXT,
  p_especialidade TEXT,
  p_categoria TEXT DEFAULT 'SC',
  p_prioridade TEXT DEFAULT 'ROTINA',
  p_volume_total INTEGER DEFAULT NULL,
  p_is_plantao BOOLEAN DEFAULT false
)
RETURNS TABLE(
  valor_unitario NUMERIC,
  faixa_aplicada TEXT,
  volume_calculado INTEGER,
  cond_volume_usada TEXT,
  detalhes_calculo JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preco_linha RECORD;
  volume_para_calculo INTEGER;
  valor_final NUMERIC := 0;
  faixa_usada TEXT := 'não encontrado';
  detalhes JSONB := '{}';
BEGIN
  -- Buscar linha de preço específica
  SELECT ps.* INTO preco_linha
  FROM precos_servicos ps
  INNER JOIN contratos_clientes cc ON cc.cliente_id = ps.cliente_id
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(ps.especialidade)) = UPPER(TRIM(p_especialidade))
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')))
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')))
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
    AND ps.ativo = true
  ORDER BY ps.created_at DESC
  LIMIT 1;

  -- Se não encontrou preço, retornar zero
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'preço não cadastrado'::TEXT, 0::INTEGER, 'N/A'::TEXT, 
                        jsonb_build_object('erro', 'Preço não encontrado para os parâmetros informados')::JSONB;
    RETURN;
  END IF;

  -- Calcular volume baseado no cond_volume da linha de preço
  IF p_volume_total IS NOT NULL THEN
    volume_para_calculo := p_volume_total;
  ELSE
    -- Calcular volume conforme cond_volume da linha de preço
    CASE UPPER(TRIM(COALESCE(preco_linha.cond_volume, 'MOD/ESP/CAT')))
      WHEN 'MOD/ESP' THEN
        -- Somar TODOS os exames da modalidade e especialidade (independente da categoria)
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT nome FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade));
        
      WHEN 'MOD/ESP/CAT' THEN
        -- Somar apenas exames da modalidade, especialidade E categoria específica
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT nome FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')));
        
      ELSE
        -- Fallback para MOD/ESP/CAT
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT nome FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')));
    END CASE;
  END IF;

  -- Aplicar lógica de faixas de volume da linha de preço
  IF preco_linha.faixas_volume IS NOT NULL AND jsonb_array_length(preco_linha.faixas_volume) > 0 THEN
    -- Usar faixas de volume específicas
    DECLARE
      faixa JSONB;
    BEGIN
      FOR faixa IN SELECT * FROM jsonb_array_elements(preco_linha.faixas_volume)
      LOOP
        IF volume_para_calculo >= (faixa->>'volume_inicial')::INTEGER 
           AND volume_para_calculo <= (faixa->>'volume_final')::INTEGER THEN
          valor_final := (faixa->>'preco')::NUMERIC;
          faixa_usada := (faixa->>'volume_inicial')::TEXT || '-' || (faixa->>'volume_final')::TEXT;
          EXIT;
        END IF;
      END LOOP;
    END;
  ELSE
    -- Usar valores base se não há faixas específicas
    IF volume_para_calculo BETWEEN COALESCE(preco_linha.volume_inicial, 1) AND COALESCE(preco_linha.volume_final, 999999) THEN
      valor_final := CASE 
        WHEN p_is_plantao AND preco_linha.valor_urgencia IS NOT NULL THEN preco_linha.valor_urgencia
        ELSE COALESCE(preco_linha.valor_base, 0) 
      END;
      faixa_usada := COALESCE(preco_linha.volume_inicial, 1)::TEXT || '-' || COALESCE(preco_linha.volume_final, 999999)::TEXT;
    END IF;
  END IF;

  -- Montar detalhes do cálculo
  detalhes := jsonb_build_object(
    'cliente_id', p_cliente_id,
    'modalidade', p_modalidade,
    'especialidade', p_especialidade,
    'categoria', p_categoria,
    'prioridade', p_prioridade,
    'is_plantao', p_is_plantao,
    'volume_parametro', p_volume_total,
    'cond_volume_linha', preco_linha.cond_volume,
    'volume_calculado_final', volume_para_calculo,
    'preco_linha_id', preco_linha.id,
    'valor_base_linha', preco_linha.valor_base,
    'valor_urgencia_linha', preco_linha.valor_urgencia,
    'faixas_volume_disponiveis', preco_linha.faixas_volume
  );

  RETURN QUERY SELECT 
    valor_final,
    faixa_usada,
    volume_para_calculo,
    COALESCE(preco_linha.cond_volume, 'MOD/ESP/CAT'),
    detalhes;
END;
$$;