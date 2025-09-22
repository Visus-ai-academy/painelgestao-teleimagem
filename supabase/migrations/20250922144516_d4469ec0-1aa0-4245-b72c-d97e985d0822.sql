-- Corrigir a função calcular_preco_exame para funcionar corretamente com a estrutura atual
DROP FUNCTION IF EXISTS calcular_preco_exame(uuid, text, text, text, text, integer, text);

CREATE OR REPLACE FUNCTION calcular_preco_exame(
  p_cliente_id uuid, 
  p_modalidade text, 
  p_especialidade text, 
  p_categoria text, 
  p_prioridade text, 
  p_volume_total integer, 
  p_periodo text
)
RETURNS TABLE(
  valor_unitario numeric,
  faixa_volume text,
  detalhes_calculo jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco RECORD;
  v_detalhes jsonb := '{}';
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));

  -- Normalizar prioridade (variações com/sem acento)
  IF p_prioridade IN ('URGENTE','URGENCIA') THEN p_prioridade := 'URGÊNCIA'; END IF;
  IF p_prioridade = 'PLANTAO' THEN p_prioridade := 'PLANTÃO'; END IF;

  -- Busca EXATA por modalidade + especialidade + categoria + prioridade específica
  SELECT ps.*, ps.considera_prioridade_plantao
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

  -- Se não encontrou preço, retornar erro
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
        'volume', p_volume_total,
        'cliente_id', p_cliente_id
      ) as detalhes_calculo;
    RETURN;
  END IF;

  -- Aplicar valor baseado na prioridade
  IF p_prioridade = 'URGÊNCIA' THEN
    -- Para urgência, usar valor_urgencia se disponível, senão valor_base
    RETURN QUERY SELECT 
      COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0)::numeric,
      CASE 
        WHEN v_preco.volume_inicial IS NOT NULL AND v_preco.volume_final IS NOT NULL 
        THEN v_preco.volume_inicial || '-' || v_preco.volume_final
        WHEN v_preco.volume_inicial IS NOT NULL 
        THEN v_preco.volume_inicial || '+'
        ELSE 'FIXO'
      END::text,
      jsonb_build_object(
        'preco_encontrado', row_to_json(v_preco),
        'valor_aplicado', COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0),
        'motivo', 'Prioridade URGÊNCIA - valor_urgencia aplicado',
        'busca_parametros', jsonb_build_object(
          'modalidade', p_modalidade,
          'especialidade', p_especialidade,
          'categoria', p_categoria,
          'prioridade', p_prioridade,
          'volume', p_volume_total
        )
      );
  ELSIF p_prioridade = 'PLANTÃO' THEN
    -- Para plantão, usar valor_urgencia se disponível, senão valor_base
    RETURN QUERY SELECT 
      COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0)::numeric,
      CASE 
        WHEN v_preco.volume_inicial IS NOT NULL AND v_preco.volume_final IS NOT NULL 
        THEN v_preco.volume_inicial || '-' || v_preco.volume_final
        WHEN v_preco.volume_inicial IS NOT NULL 
        THEN v_preco.volume_inicial || '+'
        ELSE 'FIXO'
      END::text,
      jsonb_build_object(
        'preco_encontrado', row_to_json(v_preco),
        'valor_aplicado', COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0),
        'motivo', 'Prioridade PLANTÃO - valor_urgencia aplicado',
        'busca_parametros', jsonb_build_object(
          'modalidade', p_modalidade,
          'especialidade', p_especialidade,
          'categoria', p_categoria,
          'prioridade', p_prioridade,
          'volume', p_volume_total
        )
      );
  ELSE
    -- Para rotina, usar valor_base
    RETURN QUERY SELECT 
      COALESCE(v_preco.valor_base, 0)::numeric,
      CASE 
        WHEN v_preco.volume_inicial IS NOT NULL AND v_preco.volume_final IS NOT NULL 
        THEN v_preco.volume_inicial || '-' || v_preco.volume_final
        WHEN v_preco.volume_inicial IS NOT NULL 
        THEN v_preco.volume_inicial || '+'
        ELSE 'FIXO'
      END::text,
      jsonb_build_object(
        'preco_encontrado', row_to_json(v_preco),
        'valor_aplicado', COALESCE(v_preco.valor_base, 0),
        'motivo', 'Prioridade ROTINA - valor_base aplicado',
        'busca_parametros', jsonb_build_object(
          'modalidade', p_modalidade,
          'especialidade', p_especialidade,
          'categoria', p_categoria,
          'prioridade', p_prioridade,
          'volume', p_volume_total
        )
      );
  END IF;
END;
$$;