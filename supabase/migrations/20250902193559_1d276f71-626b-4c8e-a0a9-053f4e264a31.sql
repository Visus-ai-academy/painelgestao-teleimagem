-- Criar funções RPC para corrigir modalidades (contorna problema de column reference)

CREATE OR REPLACE FUNCTION update_modalidade_cr_dx_to_rx(p_arquivo_fonte text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE volumetria_mobilemed 
  SET "MODALIDADE" = 'RX', updated_at = now()
  WHERE arquivo_fonte = p_arquivo_fonte
    AND "MODALIDADE" IN ('CR', 'DX')
    AND "ESTUDO_DESCRICAO" NOT ILIKE '%mamografia%'
    AND "ESTUDO_DESCRICAO" NOT ILIKE '%mamogra%';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION update_modalidade_mamografia_to_mg(p_arquivo_fonte text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE volumetria_mobilemed 
  SET "MODALIDADE" = 'MG', updated_at = now()
  WHERE arquivo_fonte = p_arquivo_fonte
    AND "MODALIDADE" IN ('CR', 'DX')
    AND ("ESTUDO_DESCRICAO" ILIKE '%mamografia%' OR "ESTUDO_DESCRICAO" ILIKE '%mamogra%');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;