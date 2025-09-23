-- Primeiro dropar a função existente para poder recriar com nova assinatura
DROP FUNCTION IF EXISTS public.calcular_preco_exame(uuid,text,text,text,text,integer,boolean);

-- Recriar função calcular_preco_exame corrigida
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id UUID,
  p_modalidade TEXT,
  p_especialidade TEXT,
  p_categoria TEXT DEFAULT 'SC',
  p_prioridade TEXT DEFAULT 'ROTINA',
  p_volume_total INTEGER DEFAULT 1,
  p_is_plantao BOOLEAN DEFAULT false
)
RETURNS TABLE(
  valor_unitario NUMERIC,
  volume_calculado INTEGER,
  cond_volume_usada TEXT,
  faixa_aplicada TEXT,
  detalhes_calculo JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cond_volume TEXT := 'MOD/ESP/CAT';
  v_valor_base NUMERIC := 0;
  v_valor_urgencia NUMERIC := 0;
  v_valor_final NUMERIC := 0;
  v_faixa_info TEXT := 'N/A';
  preco_encontrado RECORD;
BEGIN
  -- Buscar condição de volume no contrato (não em precos_servicos)
  SELECT cc.cond_volume INTO v_cond_volume
  FROM contratos_clientes cc
  WHERE cc.cliente_id = p_cliente_id
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  ORDER BY cc.created_at DESC
  LIMIT 1;
  
  -- Se não encontrar, usar padrão
  IF v_cond_volume IS NULL THEN
    v_cond_volume := 'MOD/ESP/CAT';
  END IF;
  
  -- Buscar preço na tabela precos_servicos
  SELECT 
    ps.valor_base,
    ps.valor_urgencia,
    ps.volume_inicial,
    ps.volume_final,
    CONCAT(
      'Vol: ', COALESCE(ps.volume_inicial, 0), 
      '-', COALESCE(ps.volume_final, 999999)
    ) as faixa_descricao
  INTO preco_encontrado
  FROM precos_servicos ps
  INNER JOIN clientes c ON c.id = ps.cliente_id
  INNER JOIN modalidades m ON m.id = ps.modalidade_id
  INNER JOIN especialidades e ON e.id = ps.especialidade_id
  INNER JOIN categorias_exame cat ON cat.id = ps.categoria_exame_id
  LEFT JOIN prioridades pr ON pr.id = ps.prioridade_id
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(m.nome) = UPPER(p_modalidade)
    AND UPPER(e.nome) = UPPER(p_especialidade)
    AND UPPER(cat.nome) = UPPER(p_categoria)
    AND (
      pr.nome IS NULL 
      OR UPPER(pr.nome) = UPPER(p_prioridade)
      OR (p_is_plantao AND UPPER(pr.nome) IN ('PLANTÃO', 'URGENTE', 'URGÊNCIA'))
    )
    AND (ps.volume_inicial IS NULL OR p_volume_total >= ps.volume_inicial)
    AND (ps.volume_final IS NULL OR p_volume_total <= ps.volume_final)
    AND ps.ativo = true
  ORDER BY 
    CASE WHEN pr.nome IS NOT NULL THEN 1 ELSE 2 END, -- Prioriza match exato de prioridade
    ps.volume_inicial DESC NULLS LAST -- Maior volume_inicial em caso de empate
  LIMIT 1;
  
  -- Se encontrou preço, aplicar valores
  IF FOUND THEN
    v_valor_base := COALESCE(preco_encontrado.valor_base, 0);
    v_valor_urgencia := COALESCE(preco_encontrado.valor_urgencia, v_valor_base);
    v_faixa_info := preco_encontrado.faixa_descricao;
    
    -- Aplicar valor baseado na prioridade
    IF p_is_plantao OR UPPER(p_prioridade) IN ('PLANTÃO', 'URGENTE', 'URGÊNCIA') THEN
      v_valor_final := v_valor_urgencia;
    ELSE
      v_valor_final := v_valor_base;
    END IF;
  ELSE
    -- Preço não encontrado, usar valor padrão 0
    v_valor_final := 0;
    v_faixa_info := 'Preço não configurado';
  END IF;
  
  RETURN QUERY SELECT 
    v_valor_final,
    p_volume_total,
    v_cond_volume,
    v_faixa_info,
    jsonb_build_object(
      'cliente_id', p_cliente_id,
      'modalidade', p_modalidade,
      'especialidade', p_especialidade,
      'categoria', p_categoria,
      'prioridade', p_prioridade,
      'volume_total', p_volume_total,
      'is_plantao', p_is_plantao,
      'valor_base', v_valor_base,
      'valor_urgencia', v_valor_urgencia,
      'valor_aplicado', v_valor_final,
      'precos_encontrado', FOUND
    );
END;
$$;