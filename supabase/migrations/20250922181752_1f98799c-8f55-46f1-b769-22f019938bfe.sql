-- Remover função simplificada e recriar com lógica completa
DROP FUNCTION IF EXISTS public.calcular_preco_exame_final(uuid, text, text, text, text, integer);

-- Recriar função completa com todas as regras de negócio
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_categoria text DEFAULT 'SC',
  p_prioridade text DEFAULT 'ROTINA',
  p_volume_total integer DEFAULT 1,
  p_is_plantao boolean DEFAULT false
)
RETURNS TABLE(
  valor_unitario numeric,
  faixa_volume text,
  detalhes_calculo jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preco RECORD;
  v_valor_final numeric := 0;
  v_faixa_aplicada text := 'N/A';
  v_detalhes jsonb := '{}';
  v_prioridade_busca text;
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

  -- Buscar preço considerando volume inicial, volume final e condições
  SELECT ps.*, 
         CONCAT(COALESCE(ps.vol_inicial::text, '0'), '-', COALESCE(ps.vol_final::text, '∞')) as faixa_desc
  INTO v_preco
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = p_modalidade
    AND UPPER(TRIM(ps.especialidade)) = p_especialidade
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = v_prioridade_busca
    AND ps.ativo = true
    -- Validar faixas de volume
    AND (ps.vol_inicial IS NULL OR p_volume_total >= COALESCE(ps.vol_inicial, 1))
    AND (ps.vol_final IS NULL OR p_volume_total <= COALESCE(ps.vol_final, 999999))
    -- Considerar plantão se configurado
    AND (ps.considera_plantao = false OR (ps.considera_plantao = true AND p_is_plantao))
  ORDER BY 
    -- Priorizar faixas mais específicas (menor range)
    COALESCE(ps.vol_final, 999999) - COALESCE(ps.vol_inicial, 1) ASC,
    ps.vol_inicial ASC
  LIMIT 1;

  -- Se não encontrou com a prioridade específica, buscar fallback
  IF NOT FOUND AND v_prioridade_busca != 'ROTINA' THEN
    SELECT ps.*, 
           CONCAT(COALESCE(ps.vol_inicial::text, '0'), '-', COALESCE(ps.vol_final::text, '∞')) as faixa_desc
    INTO v_preco
    FROM precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = p_modalidade
      AND UPPER(TRIM(ps.especialidade)) = p_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
      AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = 'ROTINA'
      AND ps.ativo = true
      AND (ps.vol_inicial IS NULL OR p_volume_total >= COALESCE(ps.vol_inicial, 1))
      AND (ps.vol_final IS NULL OR p_volume_total <= COALESCE(ps.vol_final, 999999))
      AND (ps.considera_plantao = false OR (ps.considera_plantao = true AND p_is_plantao))
    ORDER BY 
      COALESCE(ps.vol_final, 999999) - COALESCE(ps.vol_inicial, 1) ASC,
      ps.vol_inicial ASC
    LIMIT 1;
  END IF;

  -- Calcular valor final baseado na prioridade
  IF FOUND THEN
    v_faixa_aplicada := v_preco.faixa_desc;
    
    IF v_prioridade_busca = 'URGÊNCIA' THEN
      v_valor_final := COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0);
    ELSE
      v_valor_final := COALESCE(v_preco.valor_base, 0);
    END IF;
    
    -- Montar detalhes do cálculo
    v_detalhes := jsonb_build_object(
      'preco_encontrado', true,
      'prioridade_usada', v_prioridade_busca,
      'considera_plantao', v_preco.considera_plantao,
      'vol_inicial', v_preco.vol_inicial,
      'vol_final', v_preco.vol_final,
      'cond_volume', v_preco.cond_volume,
      'valor_base', v_preco.valor_base,
      'valor_urgencia', v_preco.valor_urgencia,
      'volume_fornecido', p_volume_total,
      'is_plantao', p_is_plantao
    );
  ELSE
    v_detalhes := jsonb_build_object(
      'preco_encontrado', false,
      'motivo', 'Nenhum preço encontrado para os critérios especificados',
      'parametros_busca', jsonb_build_object(
        'cliente_id', p_cliente_id,
        'modalidade', p_modalidade,
        'especialidade', p_especialidade,
        'categoria', p_categoria,
        'prioridade', v_prioridade_busca,
        'volume_total', p_volume_total,
        'is_plantao', p_is_plantao
      )
    );
  END IF;

  RETURN QUERY SELECT v_valor_final, v_faixa_aplicada, v_detalhes;
END;
$$;