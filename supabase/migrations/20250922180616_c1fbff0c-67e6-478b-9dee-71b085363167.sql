-- Limpar todas as versões da função e recriar somente a correta
-- Remover por OID específico se necessário
DROP FUNCTION IF EXISTS public.calcular_preco_exame(uuid, text, text, text, text, integer, boolean);

-- Função final simplificada para calcular preços
CREATE OR REPLACE FUNCTION public.calcular_preco_exame_final(
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
  v_valor_final numeric := 0;
  v_valor_base numeric;
  v_valor_urgencia numeric;
BEGIN
  -- Normalizar parâmetros
  p_modalidade := UPPER(TRIM(COALESCE(p_modalidade, '')));
  p_especialidade := UPPER(TRIM(COALESCE(p_especialidade, '')));
  p_categoria := UPPER(TRIM(COALESCE(p_categoria, 'SC')));
  p_prioridade := UPPER(TRIM(COALESCE(p_prioridade, 'ROTINA')));

  -- Normalizar prioridades
  IF p_prioridade IN ('URGENTE','URGENCIA') THEN p_prioridade := 'URGÊNCIA'; END IF;
  IF p_prioridade = 'PLANTAO' THEN p_prioridade := 'PLANTÃO'; END IF;

  -- Buscar preço específico
  SELECT ps.valor_base, ps.valor_urgencia
  INTO v_valor_base, v_valor_urgencia
  FROM precos_servicos ps
  WHERE ps.cliente_id = p_cliente_id
    AND UPPER(TRIM(ps.modalidade)) = p_modalidade
    AND UPPER(TRIM(ps.especialidade)) = p_especialidade
    AND UPPER(TRIM(COALESCE(ps.categoria, 'SC'))) = p_categoria
    AND UPPER(TRIM(COALESCE(ps.prioridade, 'ROTINA'))) = p_prioridade
    AND ps.ativo = true
  LIMIT 1;

  -- Retornar o valor correto baseado na prioridade
  IF v_valor_base IS NOT NULL THEN
    IF p_prioridade = 'URGÊNCIA' THEN
      v_valor_final := COALESCE(v_valor_urgencia, v_valor_base, 0);
    ELSE
      v_valor_final := COALESCE(v_valor_base, 0);
    END IF;
  END IF;

  RETURN v_valor_final;
END;
$$;