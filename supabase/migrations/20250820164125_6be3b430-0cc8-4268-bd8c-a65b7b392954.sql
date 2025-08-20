-- Primeiro, vamos corrigir o espaço no nome_mobilemed do CLIMAGEM
UPDATE clientes 
SET nome_mobilemed = TRIM(nome_mobilemed)
WHERE nome_mobilemed IS NOT NULL AND nome_mobilemed != TRIM(nome_mobilemed);

-- Criar ou atualizar função que garante o mapeamento correto do Cliente_Nome_Fantasia
CREATE OR REPLACE FUNCTION public.aplicar_mapeamento_nome_fantasia()
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar o nome fantasia baseado no nome_mobilemed ou EMPRESA
  SELECT c.nome_fantasia INTO NEW."Cliente_Nome_Fantasia"
  FROM clientes c
  WHERE TRIM(c.nome_mobilemed) = TRIM(NEW."EMPRESA")
  LIMIT 1;
  
  -- Se não encontrou pelo nome_mobilemed, tentar pelo nome exato
  IF NEW."Cliente_Nome_Fantasia" IS NULL THEN
    SELECT c.nome_fantasia INTO NEW."Cliente_Nome_Fantasia"
    FROM clientes c
    WHERE TRIM(c.nome) = TRIM(NEW."EMPRESA")
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, usar o valor original
  IF NEW."Cliente_Nome_Fantasia" IS NULL THEN
    NEW."Cliente_Nome_Fantasia" := NEW."EMPRESA";
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_aplicar_mapeamento_nome_fantasia ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_mapeamento_nome_fantasia
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_mapeamento_nome_fantasia();

-- Aplicar correção nos dados existentes
UPDATE volumetria_mobilemed vm
SET "Cliente_Nome_Fantasia" = c.nome_fantasia
FROM clientes c
WHERE TRIM(c.nome_mobilemed) = TRIM(vm."EMPRESA")
  AND (vm."Cliente_Nome_Fantasia" IS NULL OR vm."Cliente_Nome_Fantasia" != c.nome_fantasia);

-- Aplicar correção para casos onde nome_mobilemed não funcionou, tentar por nome
UPDATE volumetria_mobilemed vm
SET "Cliente_Nome_Fantasia" = c.nome_fantasia
FROM clientes c
WHERE TRIM(c.nome) = TRIM(vm."EMPRESA")
  AND (vm."Cliente_Nome_Fantasia" IS NULL OR vm."Cliente_Nome_Fantasia" = vm."EMPRESA");

-- Verificar se contratos estão vinculados aos clientes corretos
-- Atualizar referências se necessário