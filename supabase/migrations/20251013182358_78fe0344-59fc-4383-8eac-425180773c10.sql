
-- Corrigir função identificar_duplicados_precos_servicos para considerar volumes
DROP FUNCTION IF EXISTS identificar_duplicados_precos_servicos();

CREATE OR REPLACE FUNCTION identificar_duplicados_precos_servicos()
RETURNS TABLE(
  cliente_id uuid,
  cliente_nome text,
  modalidade text,
  especialidade text,
  prioridade text,
  categoria text,
  volume_inicial integer,
  volume_final integer,
  total_duplicados bigint,
  valores_diferentes numeric[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    COALESCE(ps.volume_inicial, -1) as volume_inicial,
    COALESCE(ps.volume_final, -1) as volume_final,
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
    COALESCE(ps.categoria, 'N/A'),
    COALESCE(ps.volume_inicial, -1),
    COALESCE(ps.volume_final, -1)
  HAVING COUNT(*) > 1
  ORDER BY total_duplicados DESC, cliente_nome, modalidade, especialidade, volume_inicial;
END;
$$;

COMMENT ON FUNCTION identificar_duplicados_precos_servicos() IS 'Identifica registros duplicados em precos_servicos considerando volumes';
