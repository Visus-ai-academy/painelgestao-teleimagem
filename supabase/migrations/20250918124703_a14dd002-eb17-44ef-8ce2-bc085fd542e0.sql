-- 1) Remover duplicatas mantendo o registro mais recente por combinação (inclui prioridade)
WITH dedup AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        cliente_id,
        modalidade,
        especialidade,
        COALESCE(categoria,'SC'),
        COALESCE(prioridade,'ROTINA'),
        COALESCE(volume_inicial, -1),
        COALESCE(volume_final, -1),
        COALESCE(tipo_preco,'normal')
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM precos_servicos
  WHERE ativo = true
)
UPDATE precos_servicos ps
SET ativo = false,
    updated_at = now()
FROM dedup d
WHERE ps.id = d.id AND d.rn > 1;

-- 2) Garantir unicidade por combinação (com tratamento de NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS ux_precos_servicos_unicos
ON precos_servicos (
  cliente_id,
  modalidade,
  especialidade,
  COALESCE(categoria,'SC'),
  COALESCE(prioridade,'ROTINA'),
  COALESCE(volume_inicial, -1),
  COALESCE(volume_final, -1),
  COALESCE(tipo_preco,'normal')
);

-- 3) Atualizar a função de cálculo para considerar prioridade na seleção
CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente_id uuid,
  p_modalidade text,
  p_especialidade text,
  p_prioridade text,
  p_categoria text,
  p_volume_total integer,
  p_is_plantao boolean DEFAULT false
) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_preco numeric := 0;
  v_valor_base numeric := 0;
  v_valor_urgencia numeric := 0;
  v_considera_plantao boolean := false;
  v_prioridade text := COALESCE(UPPER(TRIM(p_prioridade)), 'ROTINA');
BEGIN
  -- Normalizar prioridade (com/sem acento)
  IF v_prioridade IN ('URGENTE','URGENCIA') THEN v_prioridade := 'URGÊNCIA'; END IF;
  IF v_prioridade = 'PLANTAO' THEN v_prioridade := 'PLANTÃO'; END IF;

  -- 1) PREÇO ESPECIAL SEM FAIXA DE VOLUME (match exato MOD/ESP/CAT + prioridade preferida)
  v_valor_base := NULL; v_valor_urgencia := NULL; v_considera_plantao := false;
  SELECT ps.valor_base, ps.valor_urgencia, COALESCE(ps.considera_prioridade_plantao, false)
  INTO v_valor_base, v_valor_urgencia, v_considera_plantao
  FROM precos_servicos ps
  WHERE ps.ativo = true
    AND ps.tipo_preco = 'especial'
    AND ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(ps.especialidade)) = UPPER(TRIM(p_especialidade))
    AND UPPER(TRIM(COALESCE(ps.categoria,'SC'))) = UPPER(TRIM(COALESCE(p_categoria,'SC')))
  ORDER BY 
    CASE WHEN UPPER(TRIM(COALESCE(ps.prioridade,'ROTINA'))) = v_prioridade THEN 0
         WHEN UPPER(TRIM(COALESCE(ps.prioridade,'ROTINA'))) = 'ROTINA' THEN 1
         ELSE 2 END,
    ps.updated_at DESC
  LIMIT 1;

  IF v_valor_base IS NOT NULL THEN
    IF v_prioridade = 'URGÊNCIA' OR (v_prioridade = 'PLANTÃO' AND v_considera_plantao) THEN
      v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0);
    ELSE
      v_preco := COALESCE(v_valor_base, 0);
    END IF;
    RETURN COALESCE(v_preco, 0);
  END IF;

  -- 2) FAIXAS DE VOLUME (MOD/ESP/CAT) COM PRIORIDADE E ORDEM CORRETA
  v_valor_base := NULL; v_valor_urgencia := NULL; v_considera_plantao := false;
  SELECT ps.valor_base, ps.valor_urgencia, COALESCE(ps.considera_prioridade_plantao, false)
  INTO v_valor_base, v_valor_urgencia, v_considera_plantao
  FROM precos_servicos ps
  WHERE ps.ativo = true
    AND ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = UPPER(TRIM(p_modalidade))
    AND UPPER(TRIM(ps.especialidade)) = UPPER(TRIM(p_especialidade))
    AND UPPER(TRIM(COALESCE(ps.categoria,'SC'))) = UPPER(TRIM(COALESCE(p_categoria,'SC')))
    AND (
      (ps.volume_inicial IS NULL AND ps.volume_final IS NULL) OR
      (ps.volume_inicial IS NOT NULL AND ps.volume_final IS NOT NULL AND p_volume_total BETWEEN ps.volume_inicial AND ps.volume_final) OR
      (ps.volume_inicial IS NOT NULL AND ps.volume_final IS NULL AND p_volume_total >= ps.volume_inicial)
    )
  ORDER BY 
    CASE WHEN UPPER(TRIM(COALESCE(ps.prioridade,'ROTINA'))) = v_prioridade THEN 0
         WHEN UPPER(TRIM(COALESCE(ps.prioridade,'ROTINA'))) = 'ROTINA' THEN 1
         ELSE 2 END,
    CASE WHEN ps.volume_inicial IS NOT NULL THEN 0 ELSE 1 END,
    ps.volume_inicial ASC NULLS LAST,
    ps.updated_at DESC
  LIMIT 1;

  IF v_valor_base IS NOT NULL THEN
    IF v_prioridade = 'URGÊNCIA' OR (v_prioridade = 'PLANTÃO' AND v_considera_plantao) THEN
      v_preco := COALESCE(v_valor_urgencia, v_valor_base, 0);
    ELSE
      v_preco := COALESCE(v_valor_base, 0);
    END IF;
  ELSE
    v_preco := 0;
  END IF;

  RETURN COALESCE(v_preco, 0);
END;
$$;