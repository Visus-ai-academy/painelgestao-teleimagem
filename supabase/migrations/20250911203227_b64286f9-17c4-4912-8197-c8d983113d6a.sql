-- Update price calculation to be more tolerant with priority and case, and to fall back to ROTINA/null when URGÊNCIA/PLANTÃO is requested
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_prioridade text,
  p_categoria text,
  p_volume_total integer,
  p_is_plantao boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_valor numeric;
  v_modalidade text := UPPER(TRIM(COALESCE(p_modalidade, '')));
  v_especialidade text := UPPER(TRIM(COALESCE(p_especialidade, '')));
  v_categoria text := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  v_prioridade text := UPPER(TRIM(COALESCE(p_prioridade, '')));
BEGIN
  -- 1) Primeira tentativa: match completo (ignorando maiúsculas/minúsculas) e permitindo ROTINA como fallback para URGÊNCIA/PLANTÃO
  SELECT CASE 
           WHEN (v_prioridade IN ('URGÊNCIA','URGENCIA') OR (p_is_plantao AND COALESCE(ps.considera_prioridade_plantao, false)))
             THEN COALESCE(ps.valor_urgencia, ps.valor_base)
           ELSE ps.valor_base
         END
    INTO v_valor
  FROM public.precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = v_modalidade
    AND UPPER(TRIM(ps.especialidade)) = v_especialidade
    AND (
      UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = v_categoria
      OR (ps.categoria IS NULL AND v_categoria = 'SC')
    )
    AND (
      ps.prioridade IS NULL OR ps.prioridade = ''
      OR UPPER(TRIM(ps.prioridade)) = v_prioridade
      OR (
        v_prioridade IN ('URGENCIA','URGÊNCIA','PLANTAO','PLANTÃO')
        AND UPPER(TRIM(ps.prioridade)) = 'ROTINA'
      )
    )
    AND (ps.volume_inicial IS NULL OR p_volume_total >= ps.volume_inicial)
    AND (ps.volume_final IS NULL OR p_volume_total <= ps.volume_final)
  ORDER BY 
    -- Priorizar match exato de prioridade
    CASE 
      WHEN UPPER(TRIM(ps.prioridade)) = v_prioridade THEN 0
      WHEN v_prioridade IN ('URGENCIA','URGÊNCIA','PLANTAO','PLANTÃO') AND UPPER(TRIM(ps.prioridade)) = 'ROTINA' THEN 1
      WHEN ps.prioridade IS NULL OR ps.prioridade = '' THEN 2
      ELSE 3
    END,
    ps.volume_inicial DESC NULLS LAST
  LIMIT 1;

  -- 2) Fallback: se não encontrou e categoria não é SC, tentar novamente com SC
  IF v_valor IS NULL AND v_categoria <> 'SC' THEN
    SELECT CASE 
             WHEN (v_prioridade IN ('URGÊNCIA','URGENCIA') OR (p_is_plantao AND COALESCE(ps.considera_prioridade_plantao, false)))
               THEN COALESCE(ps.valor_urgencia, ps.valor_base)
             ELSE ps.valor_base
           END
      INTO v_valor
    FROM public.precos_servicos ps
    WHERE ps.cliente_id = p_cliente_id
      AND UPPER(TRIM(ps.modalidade)) = v_modalidade
      AND UPPER(TRIM(ps.especialidade)) = v_especialidade
      AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = 'SC'
      AND (
        ps.prioridade IS NULL OR ps.prioridade = ''
        OR UPPER(TRIM(ps.prioridade)) = v_prioridade
        OR (
          v_prioridade IN ('URGENCIA','URGÊNCIA','PLANTAO','PLANTÃO')
          AND UPPER(TRIM(ps.prioridade)) = 'ROTINA'
        )
      )
      AND (ps.volume_inicial IS NULL OR p_volume_total >= ps.volume_inicial)
      AND (ps.volume_final IS NULL OR p_volume_total <= ps.volume_final)
    ORDER BY 
      CASE 
        WHEN UPPER(TRIM(ps.prioridade)) = v_prioridade THEN 0
        WHEN v_prioridade IN ('URGENCIA','URGÊNCIA','PLANTAO','PLANTÃO') AND UPPER(TRIM(ps.prioridade)) = 'ROTINA' THEN 1
        WHEN ps.prioridade IS NULL OR ps.prioridade = '' THEN 2
        ELSE 3
      END,
      ps.volume_inicial DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Se ainda não encontrou, retornar NULL para indicar não encontrado
  IF v_valor IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(v_valor::numeric, 2);
END;
$$;