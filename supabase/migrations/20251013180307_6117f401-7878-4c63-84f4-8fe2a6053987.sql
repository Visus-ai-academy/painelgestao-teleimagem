-- Função para identificar preços duplicados
CREATE OR REPLACE FUNCTION identificar_duplicados_precos_servicos()
RETURNS TABLE (
  cliente_id uuid,
  cliente_nome text,
  modalidade text,
  especialidade text,
  prioridade text,
  categoria text,
  total_duplicados bigint,
  valores_diferentes numeric[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.cliente_id,
    COALESCE(c.nome, ps.descricao, 'SEM CLIENTE') as cliente_nome,
    ps.modalidade,
    ps.especialidade,
    ps.prioridade,
    COALESCE(ps.categoria, 'N/A') as categoria,
    COUNT(*) as total_duplicados,
    ARRAY_AGG(DISTINCT ps.valor_base ORDER BY ps.valor_base) as valores_diferentes
  FROM precos_servicos ps
  LEFT JOIN clientes c ON c.id = ps.cliente_id
  GROUP BY 
    ps.cliente_id,
    COALESCE(c.nome, ps.descricao, 'SEM CLIENTE'),
    ps.modalidade,
    ps.especialidade,
    ps.prioridade,
    COALESCE(ps.categoria, 'N/A')
  HAVING COUNT(*) > 1
  ORDER BY total_duplicados DESC, cliente_nome, modalidade, especialidade;
END;
$$;