-- Corrigir função calcular_preco_exame para resolver problema de busca de preços
DROP FUNCTION IF EXISTS calcular_preco_exame(uuid, text, text, text, text, integer);

CREATE OR REPLACE FUNCTION calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_categoria text DEFAULT 'SC',
  p_prioridade text DEFAULT 'ROTINA',
  p_volume_total integer DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preco RECORD;
  v_valor_final numeric := 0;
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));

  -- Normalizar variações de prioridade
  IF p_prioridade IN ('URGENTE','URGENCIA') THEN p_prioridade := 'URGÊNCIA'; END IF;
  IF p_prioridade = 'PLANTAO' THEN p_prioridade := 'PLANTÃO'; END IF;

  -- Log dos parâmetros para debug
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('precos_servicos', 'CALCULAR_PRECO', p_cliente_id::text, 
          jsonb_build_object(
            'modalidade', p_modalidade,
            'especialidade', p_especialidade,
            'categoria', p_categoria,
            'prioridade', p_prioridade,
            'volume', p_volume_total
          ),
          'system', 'info');

  -- Busca EXATA por modalidade + especialidade + categoria + prioridade
  SELECT ps.*
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

  -- Se encontrou o preço
  IF FOUND THEN
    -- Para URGÊNCIA, usar valor_urgencia se disponível, senão valor_base
    IF p_prioridade = 'URGÊNCIA' THEN
      v_valor_final := COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0);
    -- Para PLANTÃO, verificar se considera_prioridade_plantao
    ELSIF p_prioridade = 'PLANTÃO' THEN
      IF COALESCE(v_preco.considera_prioridade_plantao, false) THEN
        v_valor_final := COALESCE(v_preco.valor_urgencia, v_preco.valor_base, 0);
      ELSE
        v_valor_final := COALESCE(v_preco.valor_base, 0);
      END IF;
    -- Para ROTINA, usar valor_base
    ELSE
      v_valor_final := COALESCE(v_preco.valor_base, 0);
    END IF;

    -- Log do resultado
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('precos_servicos', 'PRECO_ENCONTRADO', v_preco.id::text, 
            jsonb_build_object(
              'valor_calculado', v_valor_final,
              'valor_base', v_preco.valor_base,
              'valor_urgencia', v_preco.valor_urgencia,
              'considera_plantao', v_preco.considera_prioridade_plantao
            ),
            'system', 'info');
  ELSE
    -- Log de preço não encontrado
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('precos_servicos', 'PRECO_NAO_ENCONTRADO', p_cliente_id::text, 
            jsonb_build_object(
              'modalidade', p_modalidade,
              'especialidade', p_especialidade,
              'categoria', p_categoria,
              'prioridade', p_prioridade,
              'volume', p_volume_total
            ),
            'system', 'warning');
  END IF;

  RETURN COALESCE(v_valor_final, 0);
END;
$$;