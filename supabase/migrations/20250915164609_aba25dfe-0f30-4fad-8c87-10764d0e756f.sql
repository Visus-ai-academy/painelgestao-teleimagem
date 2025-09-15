-- Corrigir função calcular_preco_exame para lidar com preços especiais sem faixas de volume
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_categoria text,
  p_prioridade text,
  p_volume_total integer DEFAULT 0,
  p_cond_volume text DEFAULT 'MOD/ESP/CAT'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_preco numeric := 0;
  v_valor_base numeric := 0;
  v_valor_urgencia numeric := 0;
  v_considera_plantao boolean := false;
  v_debug_info text := '';
BEGIN
  -- Debug: registrar parâmetros de entrada
  v_debug_info := format('Cliente: %s, Modal: %s, Esp: %s, Cat: %s, Prior: %s, Vol: %s, CondVol: %s', 
                        p_cliente_id, p_modalidade, p_especialidade, p_categoria, p_prioridade, p_volume_total, p_cond_volume);
  
  -- Buscar preço específico primeiro (preços especiais sem faixas de volume)
  SELECT valor_base, valor_urgencia, considera_prioridade_plantao
  INTO v_valor_base, v_valor_urgencia, v_considera_plantao
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND ps.modalidade = p_modalidade
    AND ps.especialidade = p_especialidade
    AND ps.categoria = p_categoria
    AND ps.ativo = true
    AND ps.tipo_preco = 'especial'
    AND ps.volume_inicial IS NULL
    AND ps.volume_final IS NULL
  LIMIT 1;
  
  -- Se encontrou preço especial, usar diretamente
  IF v_valor_base IS NOT NULL THEN
    CASE 
      WHEN p_prioridade IN ('URGÊNCIA', 'URGENTE') THEN
        v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0);
      WHEN p_prioridade IN ('PLANTÃO', 'PLANTAO') AND v_considera_plantao THEN
        v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0); -- Usar valor urgência para plantão
      ELSE
        v_preco := COALESCE(v_valor_base, 0);
    END CASE;
    
    -- Log para debug
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('calcular_preco_exame', 'PRECO_ESPECIAL_ENCONTRADO', p_cliente_id::text, 
            jsonb_build_object(
              'parametros', v_debug_info,
              'preco_aplicado', v_preco,
              'valor_base', v_valor_base,
              'valor_urgencia', v_valor_urgencia,
              'tipo', 'especial_sem_volume'
            ), 'system', 'info');
    
    RETURN v_preco;
  END IF;
  
  -- Buscar preço por faixa de volume (lógica anterior)
  SELECT valor_base, valor_urgencia, considera_prioridade_plantao
  INTO v_valor_base, v_valor_urgencia, v_considera_plantao
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND ps.modalidade = p_modalidade
    AND ps.especialidade = p_especialidade
    AND ps.categoria = p_categoria
    AND ps.ativo = true
    AND (
      -- Sem faixa de volume definida (aplica sempre)
      (ps.volume_inicial IS NULL AND ps.volume_final IS NULL) OR
      -- Dentro da faixa de volume
      (ps.volume_inicial IS NOT NULL AND ps.volume_final IS NOT NULL 
       AND p_volume_total >= ps.volume_inicial AND p_volume_total <= ps.volume_final) OR
      -- Volume inicial definido, sem limite superior
      (ps.volume_inicial IS NOT NULL AND ps.volume_final IS NULL 
       AND p_volume_total >= ps.volume_inicial)
    )
  ORDER BY 
    -- Priorizar preços com faixa específica sobre preços gerais
    CASE WHEN ps.volume_inicial IS NOT NULL THEN 0 ELSE 1 END,
    -- CORRIGIDO: Ordenar por volume_inicial ASC para pegar a menor faixa aplicável
    ps.volume_inicial ASC NULLS LAST
  LIMIT 1;

  -- Aplicar preço baseado na prioridade
  IF v_valor_base IS NOT NULL THEN
    CASE 
      WHEN p_prioridade IN ('URGÊNCIA', 'URGENTE') THEN
        v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0);
      WHEN p_prioridade IN ('PLANTÃO', 'PLANTAO') AND v_considera_plantao THEN
        v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0);
      ELSE
        v_preco := COALESCE(v_valor_base, 0);
    END CASE;
    
    -- Log para debug
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('calcular_preco_exame', 'PRECO_FAIXA_ENCONTRADO', p_cliente_id::text, 
            jsonb_build_object(
              'parametros', v_debug_info,
              'preco_aplicado', v_preco,
              'valor_base', v_valor_base,
              'valor_urgencia', v_valor_urgencia,
              'tipo', 'faixa_volume'
            ), 'system', 'info');
  ELSE
    -- Log quando não encontra preço
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('calcular_preco_exame', 'PRECO_NAO_ENCONTRADO', p_cliente_id::text, 
            jsonb_build_object(
              'parametros', v_debug_info,
              'preco_aplicado', 0
            ), 'system', 'warning');
  END IF;

  RETURN COALESCE(v_preco, 0);
END;
$function$;