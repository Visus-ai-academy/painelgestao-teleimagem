-- Criar função RPC para correção de mamografias (CR/DX → MG)
CREATE OR REPLACE FUNCTION update_modalidade_mamografia_to_mg(
  p_arquivo_fonte text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE volumetria_mobilemed 
  SET "MODALIDADE" = 'MG', 
      updated_at = now()
  WHERE arquivo_fonte = p_arquivo_fonte
    AND "MODALIDADE" IN ('CR', 'DX')
    AND ("ESTUDO_DESCRICAO" ILIKE '%mamografia%' OR "ESTUDO_DESCRICAO" ILIKE '%mamogra%');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;