-- Drop da função antiga com retorno TABLE para permitir alterar o tipo de retorno
DROP FUNCTION IF EXISTS public.calcular_preco_exame(uuid,text,text,text,text,integer,boolean);

-- Criar função corrigida retornando NUMERIC (preço unitário)
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id UUID,
  p_modalidade TEXT,
  p_especialidade TEXT,
  p_categoria TEXT DEFAULT 'SC',
  p_prioridade TEXT DEFAULT 'ROTINA',
  p_volume_total INTEGER DEFAULT 1,
  p_is_plantao BOOLEAN DEFAULT false
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cond_volume TEXT := 'MOD/ESP/CAT';
  v_valor_base NUMERIC := 0;
  v_valor_urgencia NUMERIC := 0;
  v_valor_final NUMERIC := 0;
  preco_encontrado RECORD;
BEGIN
  -- Buscar condição de volume no contrato ativo do cliente
  SELECT cc.cond_volume INTO v_cond_volume
  FROM contratos_clientes cc
  WHERE cc.cliente_id = p_cliente_id
    AND cc.status = 'ativo'
    AND (cc.data_fim IS NULL OR cc.data_fim >= CURRENT_DATE)
  ORDER BY cc.updated_at DESC
  LIMIT 1;
  
  IF v_cond_volume IS NULL THEN
    v_cond_volume := 'MOD/ESP/CAT';
  END IF;

  -- Buscar preço na tabela precos_servicos (sem usar ps.cond_volume)
  SELECT 
    ps.valor_base,
    ps.valor_urgencia,
    ps.volume_inicial,
    ps.volume_final
  INTO preco_encontrado
  FROM precos_servicos ps
  INNER JOIN modalidades m ON m.id = ps.modalidade_id
  INNER JOIN especialidades e ON e.id = ps.especialidade_id
  INNER JOIN categorias_exame cat ON cat.id = ps.categoria_exame_id
  LEFT JOIN prioridades pr ON pr.id = ps.prioridade_id
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(m.nome) = UPPER(p_modalidade)
    AND UPPER(e.nome) = UPPER(p_especialidade)
    AND UPPER(cat.nome) = UPPER(COALESCE(p_categoria, 'SC'))
    AND (
      pr.nome IS NULL 
      OR UPPER(pr.nome) = UPPER(COALESCE(p_prioridade, 'ROTINA'))
      OR (p_is_plantao AND UPPER(pr.nome) IN ('PLANTÃO', 'PLANTAO', 'URGENTE', 'URGÊNCIA'))
    )
    AND (ps.ativo = true OR ps.ativo IS NULL)
    AND (ps.volume_inicial IS NULL OR p_volume_total >= ps.volume_inicial)
    AND (ps.volume_final IS NULL OR p_volume_total <= ps.volume_final)
  ORDER BY 
    CASE WHEN pr.nome IS NOT NULL THEN 1 ELSE 2 END,
    ps.volume_inicial DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_valor_base := COALESCE(preco_encontrado.valor_base, 0);
    v_valor_urgencia := COALESCE(preco_encontrado.valor_urgencia, v_valor_base);

    IF p_is_plantao OR UPPER(COALESCE(p_prioridade, 'ROTINA')) IN ('PLANTÃO', 'PLANTAO', 'URGENTE', 'URGÊNCIA') THEN
      v_valor_final := v_valor_urgencia;
    ELSE
      v_valor_final := v_valor_base;
    END IF;
  ELSE
    v_valor_final := 0; -- sem preço configurado
  END IF;

  RETURN v_valor_final;
END;
$$;