-- Criar função para buscar clientes com dados de volumetria
CREATE OR REPLACE FUNCTION public.get_clientes_com_volumetria()
RETURNS TABLE(
  id UUID,
  nome TEXT,
  endereco TEXT,
  status TEXT,
  ativo BOOLEAN,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  cnpj TEXT,
  volume_exames BIGINT,
  total_registros BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.endereco,
    c.status,
    c.ativo,
    c.contato,
    c.telefone,
    c.email,
    c.cnpj,
    COALESCE(v.volume_exames, 0) as volume_exames,
    COALESCE(v.total_registros, 0) as total_registros
  FROM clientes c
  LEFT JOIN (
    SELECT 
      "EMPRESA",
      SUM("VALORES") as volume_exames,
      COUNT(*) as total_registros
    FROM volumetria_mobilemed 
    WHERE "EMPRESA" IS NOT NULL 
    GROUP BY "EMPRESA"
  ) v ON c.nome = v."EMPRESA"
  WHERE c.ativo = true
  ORDER BY v.volume_exames DESC NULLS LAST;
END;
$function$;