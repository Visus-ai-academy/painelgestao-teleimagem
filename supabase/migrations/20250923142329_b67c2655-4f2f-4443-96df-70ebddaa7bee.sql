-- Corrigir função calcular_preco_exame removendo faixas_volume inexistente
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
  contrato_linha RECORD;
  volume_para_calculo INTEGER;
  valor_final NUMERIC := 0;
  faixa_usada TEXT := 'não encontrado';
  detalhes JSONB := '{}';
BEGIN
  -- Buscar contrato ativo do cliente para obter cond_volume
  SELECT cc.* INTO contrato_linha
  FROM contratos_clientes cc
  WHERE cc.cliente_id = p_cliente_id
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  ORDER BY cc.updated_at DESC
  LIMIT 1;

  -- Se não tem contrato ativo, usar padrão
  IF NOT FOUND THEN
    contrato_linha.cond_volume := 'MOD/ESP/CAT';
  END IF;

  -- Buscar linha de preço específica
  SELECT ps.* INTO preco_linha
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(ps.especialidade)) = UPPER(TRIM(p_especialidade))
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')))
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')))
    AND ps.ativo = true
  ORDER BY ps.created_at DESC
  LIMIT 1;

  -- Se não encontrou preço, retornar zero
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'preço não cadastrado'::TEXT, 0::INTEGER, 'N/A'::TEXT, 
                        jsonb_build_object('erro', 'Preço não encontrado para os parâmetros informados')::JSONB;
    RETURN;
  END IF;

  -- Calcular volume baseado no cond_volume do CONTRATO (só se p_volume_total não foi passado)
  IF p_volume_total IS NOT NULL THEN
    volume_para_calculo := p_volume_total;
  ELSE
    -- Calcular volume conforme cond_volume do contrato
    CASE UPPER(TRIM(COALESCE(contrato_linha.cond_volume, 'MOD/ESP/CAT')))
      WHEN 'MOD/ESP' THEN
        -- Somar TODOS os exames da modalidade e especialidade (independente da categoria)
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT COALESCE(nome_mobilemed, nome_fantasia, nome) FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade));
        
      WHEN 'MOD/ESP/CAT' THEN
        -- Somar apenas exames da modalidade, especialidade E categoria específica
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT COALESCE(nome_mobilemed, nome_fantasia, nome) FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')));
        
      WHEN 'MOD' THEN
        -- Somar TODOS os exames da modalidade apenas
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT COALESCE(nome_mobilemed, nome_fantasia, nome) FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade));

      ELSE
        -- Fallback para MOD/ESP/CAT
        SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_para_calculo
        FROM volumetria_mobilemed vm
        WHERE UPPER(TRIM(vm."EMPRESA")) = UPPER(TRIM((
          SELECT COALESCE(nome_mobilemed, nome_fantasia, nome) FROM clientes WHERE id = p_cliente_id LIMIT 1
        )))
        AND UPPER(TRIM(vm."MODALIDADE")) = UPPER(TRIM(p_modalidade))
        AND UPPER(TRIM(vm."ESPECIALIDADE")) = UPPER(TRIM(p_especialidade))
        AND UPPER(TRIM(COALESCE(vm."CATEGORIA", 'SC'))) = UPPER(TRIM(COALESCE(p_categoria, 'SC')));
    END CASE;
  END IF;

  -- Aplicar valores base (sem faixas complexas já que não temos essa estrutura na tabela)
  IF volume_para_calculo BETWEEN COALESCE(preco_linha.volume_inicial, 1) AND COALESCE(preco_linha.volume_final, 999999) THEN
    valor_final := CASE 
      WHEN UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA'))) = 'URGÊNCIA' AND preco_linha.valor_urgencia IS NOT NULL THEN preco_linha.valor_urgencia
      WHEN p_is_plantao AND preco_linha.valor_urgencia IS NOT NULL THEN preco_linha.valor_urgencia
      ELSE COALESCE(preco_linha.valor_base, 0) 
    END;
    faixa_usada := COALESCE(preco_linha.volume_inicial, 1)::TEXT || '-' || COALESCE(preco_linha.volume_final, 999999)::TEXT;
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
    'cond_volume_contrato', contrato_linha.cond_volume,
    'volume_calculado_final', volume_para_calculo,
    'preco_linha_id', preco_linha.id,
    'valor_base_linha', preco_linha.valor_base,
    'valor_urgencia_linha', preco_linha.valor_urgencia,
    'considera_plantao_contrato', preco_linha.considera_prioridade_plantao
  );

  RETURN QUERY SELECT 
    valor_final,
    faixa_usada,
    volume_para_calculo,
    COALESCE(contrato_linha.cond_volume, 'MOD/ESP/CAT'),
    detalhes;
END;
$$;