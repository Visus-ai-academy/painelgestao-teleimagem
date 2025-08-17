-- Adicionar campos para unidade origem e nome fantasia na tabela volumetria_mobilemed
ALTER TABLE volumetria_mobilemed 
ADD COLUMN unidade_origem TEXT,
ADD COLUMN nome_fantasia TEXT;

-- Criar índices para performance
CREATE INDEX idx_volumetria_unidade_origem ON volumetria_mobilemed(unidade_origem);
CREATE INDEX idx_volumetria_nome_fantasia ON volumetria_mobilemed(nome_fantasia);

-- Migrar dados existentes: EMPRESA vira unidade_origem
UPDATE volumetria_mobilemed 
SET unidade_origem = "EMPRESA"
WHERE unidade_origem IS NULL;

-- Criar função para buscar nome fantasia do cliente
CREATE OR REPLACE FUNCTION buscar_nome_fantasia_cliente(p_unidade_origem TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
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

-- Trigger para popular nome_fantasia automaticamente nos novos registros
CREATE OR REPLACE FUNCTION trigger_populate_nome_fantasia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Definir unidade_origem como o valor original da EMPRESA
  IF NEW.unidade_origem IS NULL THEN
    NEW.unidade_origem := NEW."EMPRESA";
  END IF;
  
  -- Buscar nome fantasia do cliente
  IF NEW.nome_fantasia IS NULL THEN
    NEW.nome_fantasia := buscar_nome_fantasia_cliente(NEW.unidade_origem);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_populate_nome_fantasia ON volumetria_mobilemed;
CREATE TRIGGER trigger_populate_nome_fantasia
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_populate_nome_fantasia();

-- Popular nome_fantasia nos dados existentes
UPDATE volumetria_mobilemed 
SET nome_fantasia = buscar_nome_fantasia_cliente(unidade_origem)
WHERE nome_fantasia IS NULL;