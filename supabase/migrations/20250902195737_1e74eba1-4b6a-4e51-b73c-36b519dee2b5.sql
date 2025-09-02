-- Criar função RPC para aplicar categorias por modalidade de forma eficiente

CREATE OR REPLACE FUNCTION update_categoria_by_modalidade(
  p_arquivo_fonte text,
  p_modalidade text, 
  p_categoria text
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
  SET "CATEGORIA" = p_categoria, 
      updated_at = now()
  WHERE arquivo_fonte = p_arquivo_fonte
    AND "MODALIDADE" = p_modalidade
    AND ("CATEGORIA" IS NULL OR "CATEGORIA" = '');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;