-- Corrigir função calcular_preco_exame para usar cond_volume específico de cada preço
DROP FUNCTION IF EXISTS public.calcular_preco_exame(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.calcular_preco_exame(
  p_cliente text,
  p_modalidade text,
  p_especialidade text,
  p_categoria text,
  p_prioridade text,
  p_periodo text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  preco_encontrado RECORD;
  volume_total INTEGER := 0;
  volume_query TEXT;
BEGIN
  -- Buscar preço mais específico com sua condição de volume
  SELECT ps.valor_base, ps.valor_urgencia, ps.vol_inicial, ps.vol_final, ps.cond_volume
  INTO preco_encontrado
  FROM precos_servicos ps
  INNER JOIN clientes c ON c.id = ps.cliente_id
  WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
    AND TRIM(ps.modalidade) = TRIM(p_modalidade)
    AND TRIM(ps.especialidade) = TRIM(p_especialidade)
    AND (TRIM(ps.categoria) = TRIM(p_categoria) OR ps.categoria IS NULL OR ps.categoria = '')
    AND (TRIM(ps.prioridade) = TRIM(p_prioridade) OR ps.prioridade IS NULL OR ps.prioridade = '')
  ORDER BY 
    CASE WHEN ps.categoria IS NOT NULL AND ps.categoria != '' THEN 1 ELSE 2 END,
    CASE WHEN ps.prioridade IS NOT NULL AND ps.prioridade != '' THEN 1 ELSE 2 END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calcular volume total baseado na condição específica do preço encontrado
  IF preco_encontrado.cond_volume = 'MOD/ESP' THEN
    -- Somar por Modalidade + Especialidade
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND TRIM(vm."ESPECIALIDADE") = TRIM(p_especialidade)
      AND vm.periodo_referencia = p_periodo;
      
  ELSIF preco_encontrado.cond_volume = 'MOD/ESP/CAT' THEN
    -- Somar por Modalidade + Especialidade + Categoria
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND TRIM(vm."ESPECIALIDADE") = TRIM(p_especialidade)
      AND TRIM(vm."CATEGORIA") = TRIM(p_categoria)
      AND vm.periodo_referencia = p_periodo;
      
  ELSE
    -- Padrão: usar apenas MOD/ESP se cond_volume não estiver definido ou for diferente
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND TRIM(vm."ESPECIALIDADE") = TRIM(p_especialidade)
      AND vm.periodo_referencia = p_periodo;
  END IF;

  -- Retornar preço baseado no volume e prioridade
  IF p_prioridade = 'Urgente' AND preco_encontrado.valor_urgencia IS NOT NULL THEN
    IF volume_total >= preco_encontrado.vol_inicial AND volume_total <= preco_encontrado.vol_final THEN
      RETURN preco_encontrado.valor_urgencia;
    END IF;
  END IF;

  -- Verificar se volume está na faixa e retornar valor base
  IF volume_total >= preco_encontrado.vol_inicial AND volume_total <= preco_encontrado.vol_final THEN
    RETURN preco_encontrado.valor_base;
  END IF;

  RETURN 0;
END;
$$;