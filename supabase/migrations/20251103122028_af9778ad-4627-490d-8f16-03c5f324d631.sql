-- Função para vincular automaticamente parâmetros a clientes
CREATE OR REPLACE FUNCTION vincular_parametro_cliente()
RETURNS TRIGGER AS $$
BEGIN
  -- Se cliente_id já está preenchido, não faz nada
  IF NEW.cliente_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta encontrar o cliente por CNPJ (prioridade 1)
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' THEN
    SELECT id INTO NEW.cliente_id
    FROM clientes
    WHERE cnpj = NEW.cnpj
    LIMIT 1;
    
    IF NEW.cliente_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tenta encontrar por nome_mobilemed (prioridade 2)
  IF NEW.nome_mobilemed IS NOT NULL AND NEW.nome_mobilemed != '' THEN
    SELECT id INTO NEW.cliente_id
    FROM clientes
    WHERE nome_mobilemed ILIKE NEW.nome_mobilemed
       OR nome ILIKE NEW.nome_mobilemed
       OR nome_fantasia ILIKE NEW.nome_mobilemed
    LIMIT 1;
    
    IF NEW.cliente_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tenta encontrar por razao_social (prioridade 3)
  IF NEW.razao_social IS NOT NULL AND NEW.razao_social != '' THEN
    SELECT id INTO NEW.cliente_id
    FROM clientes
    WHERE razao_social ILIKE NEW.razao_social
       OR nome ILIKE NEW.razao_social
    LIMIT 1;
    
    IF NEW.cliente_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tenta encontrar por nome_fantasia (prioridade 4)
  IF NEW.nome_fantasia IS NOT NULL AND NEW.nome_fantasia != '' THEN
    SELECT id INTO NEW.cliente_id
    FROM clientes
    WHERE nome_fantasia ILIKE NEW.nome_fantasia
       OR nome ILIKE NEW.nome_fantasia
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger BEFORE INSERT para vincular automaticamente
DROP TRIGGER IF EXISTS trigger_vincular_parametro_cliente ON parametros_faturamento;
CREATE TRIGGER trigger_vincular_parametro_cliente
  BEFORE INSERT ON parametros_faturamento
  FOR EACH ROW
  EXECUTE FUNCTION vincular_parametro_cliente();

-- Atualizar os 3 registros existentes sem vínculo
-- 1. CLÍNICA DE IMAGENS MÉDICAS LTDA
UPDATE parametros_faturamento pf
SET cliente_id = (
  SELECT id FROM clientes 
  WHERE cnpj = '59.030.551/0001-40' 
     OR nome_mobilemed ILIKE 'CLINICA_CIM'
     OR razao_social ILIKE 'CLÍNICA DE IMAGENS MÉDICAS%'
  LIMIT 1
)
WHERE pf.id = '571dd624-05f0-403b-a9c4-05ea3d895c51';

-- 2. CLÍNICA DE RADIOLOGIA LORENA
UPDATE parametros_faturamento pf
SET cliente_id = (
  SELECT id FROM clientes 
  WHERE cnpj = '50.446.533/0001-70'
     OR nome_mobilemed ILIKE 'CLINICA_CRL'
     OR razao_social ILIKE 'CLÍNICA DE RADIOLOGIA LORENA%'
  LIMIT 1
)
WHERE pf.id = '7fe78d85-24c8-4419-8636-5b7d1b191c65';

-- 3. DIAGNÓSTICA RADIOLOGIA LTDA
UPDATE parametros_faturamento pf
SET cliente_id = (
  SELECT id FROM clientes 
  WHERE cnpj = '25.557.033/0002-37'
     OR nome_mobilemed ILIKE 'DIAGNOSTICA'
     OR razao_social ILIKE 'DIAGNÓSTICA RADIOLOGIA%'
  LIMIT 1
)
WHERE pf.id = 'fe9b61fc-8c85-472b-875f-686e013fa1b6';