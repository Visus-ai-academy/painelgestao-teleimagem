-- Corrigir função calcular_preco_exame com nomes de colunas corretos
CREATE OR REPLACE FUNCTION calcular_preco_exame(
  p_cliente TEXT,
  p_modalidade TEXT,
  p_especialidade TEXT,
  p_categoria TEXT,
  p_prioridade TEXT,
  p_periodo TEXT
) RETURNS NUMERIC AS $$
DECLARE
  preco_encontrado RECORD;
  volume_total INTEGER := 0;
BEGIN
  -- Buscar preço mais específico com sua condição de volume
  SELECT ps.valor_base, ps.valor_urgencia, ps.volume_inicial, ps.volume_final, ps.cond_volume
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
  IF preco_encontrado.cond_volume = 'Mod' THEN
    -- Somar apenas por Modalidade
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND vm.periodo_referencia = p_periodo;
      
  ELSIF preco_encontrado.cond_volume = 'Mod/Esp' THEN
    -- Somar por Modalidade + Especialidade
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND TRIM(vm."ESPECIALIDADE") = TRIM(p_especialidade)
      AND vm.periodo_referencia = p_periodo;
      
  ELSIF preco_encontrado.cond_volume = 'Mod/Esp/Cat' THEN
    -- Somar por Modalidade + Especialidade + Categoria
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND TRIM(vm."MODALIDADE") = TRIM(p_modalidade)
      AND TRIM(vm."ESPECIALIDADE") = TRIM(p_especialidade)
      AND TRIM(vm."CATEGORIA") = TRIM(p_categoria)
      AND vm.periodo_referencia = p_periodo;
      
  ELSIF preco_encontrado.cond_volume = 'Total' THEN
    -- Somar todos os exames do cliente no período
    SELECT COALESCE(SUM(vm."VALORES"), 0) INTO volume_total
    FROM volumetria_mobilemed vm
    INNER JOIN clientes c ON (TRIM(c.nome) = TRIM(vm."EMPRESA") OR TRIM(c.nome_fantasia) = TRIM(vm."EMPRESA") OR TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA"))
    WHERE (TRIM(c.nome) = TRIM(p_cliente) OR TRIM(c.nome_fantasia) = TRIM(p_cliente) OR TRIM(c.nome_mobilemed) = TRIM(p_cliente))
      AND vm.periodo_referencia = p_periodo;
      
  ELSE
    -- Cond. Volume vazio ou NULL - não aplicar condição de volume (volume = 1)
    volume_total := 1;
  END IF;

  -- Retornar preço baseado no volume e prioridade
  IF p_prioridade = 'Urgente' AND preco_encontrado.valor_urgencia IS NOT NULL THEN
    IF volume_total >= COALESCE(preco_encontrado.volume_inicial, 1) AND volume_total <= COALESCE(preco_encontrado.volume_final, 999999) THEN
      RETURN preco_encontrado.valor_urgencia;
    END IF;
  END IF;

  -- Verificar se volume está na faixa e retornar valor base
  IF volume_total >= COALESCE(preco_encontrado.volume_inicial, 1) AND volume_total <= COALESCE(preco_encontrado.volume_final, 999999) THEN
    RETURN preco_encontrado.valor_base;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql;