-- Remover função existente e recriar com nova estrutura
DROP FUNCTION IF EXISTS public.get_clientes_com_volumetria();

-- Recriar função para incluir cidade e estado
CREATE OR REPLACE FUNCTION public.get_clientes_com_volumetria()
RETURNS TABLE(
  id UUID,
  nome TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
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
    c.cidade,
    c.estado,
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