-- Renomear campo nome_fantasia para Cliente_Nome_Fantasia
ALTER TABLE volumetria_mobilemed 
RENAME COLUMN nome_fantasia TO "Cliente_Nome_Fantasia";

-- Recriar índice com novo nome
DROP INDEX IF EXISTS idx_volumetria_nome_fantasia;
CREATE INDEX idx_volumetria_cliente_nome_fantasia ON volumetria_mobilemed("Cliente_Nome_Fantasia");

-- Atualizar função do trigger para usar o novo nome do campo
CREATE OR REPLACE FUNCTION trigger_populate_nome_fantasia()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Definir unidade_origem como o valor original da EMPRESA
  IF NEW.unidade_origem IS NULL THEN
    NEW.unidade_origem := NEW."EMPRESA";
  END IF;
  
  -- Buscar nome fantasia do cliente e popular o campo Cliente_Nome_Fantasia
  IF NEW."Cliente_Nome_Fantasia" IS NULL THEN
    NEW."Cliente_Nome_Fantasia" := buscar_nome_fantasia_cliente(NEW.unidade_origem);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar função buscar_nome_fantasia_cliente para ter search_path
CREATE OR REPLACE FUNCTION buscar_nome_fantasia_cliente(p_unidade_origem TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
DECLARE
  v_nome_fantasia TEXT;
BEGIN
  -- Buscar nome fantasia baseado no nome_mobilemed ou nome
  SELECT COALESCE(c.nome_fantasia, c.nome) INTO v_nome_fantasia
  FROM clientes c
  WHERE c.nome_mobilemed = p_unidade_origem 
     OR c.nome = p_unidade_origem
     OR c.nome_fantasia = p_unidade_origem
  ORDER BY 
    CASE 
      WHEN c.nome_mobilemed = p_unidade_origem THEN 1
      WHEN c.nome = p_unidade_origem THEN 2
      WHEN c.nome_fantasia = p_unidade_origem THEN 3
      ELSE 4
    END
  LIMIT 1;
  
  RETURN COALESCE(v_nome_fantasia, p_unidade_origem);
END;
$$;