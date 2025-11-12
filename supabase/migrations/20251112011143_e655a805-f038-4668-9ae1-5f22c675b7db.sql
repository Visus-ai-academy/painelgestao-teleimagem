-- Corrigir função calcular_preco_exame para usar cond_volume e considera_prioridade_plantao
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id UUID,
  p_modalidade TEXT,
  p_especialidade TEXT,
  p_categoria TEXT,
  p_prioridade TEXT,
  p_periodo TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  v_preco_linha RECORD;
  v_volume_calculado INTEGER := 0;
  v_preco_final NUMERIC := 0;
BEGIN
  -- 1. Buscar a linha de preço específica para obter cond_volume e considera_prioridade_plantao
  SELECT 
    id,
    preco,
    vol_inicial,
    vol_final,
    cond_volume,
    considera_prioridade_plantao
  INTO v_preco_linha
  FROM precos_servicos
  WHERE cliente_id = p_cliente_id
    AND modalidade = p_modalidade
    AND (especialidade = p_especialidade OR especialidade IS NULL)
    AND (categoria = p_categoria OR categoria IS NULL)
    AND (prioridade = p_prioridade OR prioridade IS NULL)
    AND ativo = true
  ORDER BY 
    CASE WHEN especialidade IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN categoria IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN prioridade IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1;

  -- Se não encontrou preço, retornar 0
  IF v_preco_linha.id IS NULL THEN
    RETURN 0;
  END IF;

  -- 2. Se não há faixas de volume (vol_inicial e vol_final são NULL), retornar preço direto
  IF v_preco_linha.vol_inicial IS NULL OR v_preco_linha.vol_final IS NULL THEN
    RETURN COALESCE(v_preco_linha.preco, 0);
  END IF;

  -- 3. Calcular o volume baseado em cond_volume e considera_prioridade_plantao
  CASE COALESCE(v_preco_linha.cond_volume, 'MOD/ESP/CAT')
    
    -- Condição: MOD (apenas modalidade)
    WHEN 'MOD' THEN
      IF COALESCE(v_preco_linha.considera_prioridade_plantao, false) THEN
        -- Incluir todos os exames da modalidade + plantões de qualquer modalidade
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND (
            v.modalidade = p_modalidade
            OR v.prioridade = 'PLANTÃO'
          );
      ELSE
        -- Incluir apenas exames da modalidade, excluindo plantões
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND v.modalidade = p_modalidade
          AND COALESCE(v.prioridade, '') != 'PLANTÃO';
      END IF;
    
    -- Condição: MOD/ESP (modalidade + especialidade)
    WHEN 'MOD/ESP' THEN
      IF COALESCE(v_preco_linha.considera_prioridade_plantao, false) THEN
        -- Incluir exames da modalidade+especialidade + plantões de qualquer modalidade
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND (
            (v.modalidade = p_modalidade AND v.especialidade = p_especialidade)
            OR v.prioridade = 'PLANTÃO'
          );
      ELSE
        -- Incluir apenas exames da modalidade+especialidade, excluindo plantões
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND v.modalidade = p_modalidade
          AND v.especialidade = p_especialidade
          AND COALESCE(v.prioridade, '') != 'PLANTÃO';
      END IF;
    
    -- Condição: MOD/ESP/CAT (modalidade + especialidade + categoria)
    WHEN 'MOD/ESP/CAT' THEN
      IF COALESCE(v_preco_linha.considera_prioridade_plantao, false) THEN
        -- Incluir exames da modalidade+especialidade+categoria + plantões de qualquer modalidade
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND (
            (v.modalidade = p_modalidade 
             AND v.especialidade = p_especialidade 
             AND v.categoria = p_categoria)
            OR v.prioridade = 'PLANTÃO'
          );
      ELSE
        -- Incluir apenas exames da modalidade+especialidade+categoria, excluindo plantões
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND v.modalidade = p_modalidade
          AND v.especialidade = p_especialidade
          AND v.categoria = p_categoria
          AND COALESCE(v.prioridade, '') != 'PLANTÃO';
      END IF;
    
    -- Condição: TOTAL (todos os exames)
    WHEN 'TOTAL' THEN
      IF COALESCE(v_preco_linha.considera_prioridade_plantao, false) THEN
        -- Incluir todos os exames do cliente
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo;
      ELSE
        -- Incluir todos os exames, excluindo plantões
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND COALESCE(v.prioridade, '') != 'PLANTÃO';
      END IF;
    
    -- Padrão: usar MOD/ESP/CAT se cond_volume não for reconhecido
    ELSE
      IF COALESCE(v_preco_linha.considera_prioridade_plantao, false) THEN
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND (
            (v.modalidade = p_modalidade 
             AND v.especialidade = p_especialidade 
             AND v.categoria = p_categoria)
            OR v.prioridade = 'PLANTÃO'
          );
      ELSE
        SELECT COUNT(*)
        INTO v_volume_calculado
        FROM volumetria_mobilemed v
        WHERE v.cliente_id = p_cliente_id
          AND v.periodo = p_periodo
          AND v.modalidade = p_modalidade
          AND v.especialidade = p_especialidade
          AND v.categoria = p_categoria
          AND COALESCE(v.prioridade, '') != 'PLANTÃO';
      END IF;
  END CASE;

  -- 4. Verificar se o volume calculado está dentro da faixa
  IF v_volume_calculado >= COALESCE(v_preco_linha.vol_inicial, 0) 
     AND v_volume_calculado <= COALESCE(v_preco_linha.vol_final, 999999) THEN
    v_preco_final := COALESCE(v_preco_linha.preco, 0);
  ELSE
    -- Volume fora da faixa, tentar buscar outra faixa
    SELECT preco
    INTO v_preco_final
    FROM precos_servicos
    WHERE cliente_id = p_cliente_id
      AND modalidade = p_modalidade
      AND (especialidade = p_especialidade OR especialidade IS NULL)
      AND (categoria = p_categoria OR categoria IS NULL)
      AND (prioridade = p_prioridade OR prioridade IS NULL)
      AND ativo = true
      AND v_volume_calculado >= COALESCE(vol_inicial, 0)
      AND v_volume_calculado <= COALESCE(vol_final, 999999)
    ORDER BY 
      CASE WHEN especialidade IS NOT NULL THEN 1 ELSE 2 END,
      CASE WHEN categoria IS NOT NULL THEN 1 ELSE 2 END,
      CASE WHEN prioridade IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;
    
    v_preco_final := COALESCE(v_preco_final, 0);
  END IF;

  RETURN v_preco_final;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;