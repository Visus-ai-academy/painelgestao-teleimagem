-- Corrigir função de mapeamento com search_path seguro
CREATE OR REPLACE FUNCTION public.get_nome_cliente_mapeado(nome_arquivo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  nome_mapeado TEXT;
BEGIN
  -- Buscar mapeamento ativo
  SELECT nome_sistema INTO nome_mapeado
  FROM mapeamento_nomes_clientes
  WHERE nome_arquivo = $1 AND ativo = true
  LIMIT 1;
  
  -- Se encontrou mapeamento, retornar nome do sistema
  IF nome_mapeado IS NOT NULL THEN
    RETURN nome_mapeado;
  END IF;
  
  -- Se não encontrou, retornar nome original
  RETURN nome_arquivo;
END;
$$;