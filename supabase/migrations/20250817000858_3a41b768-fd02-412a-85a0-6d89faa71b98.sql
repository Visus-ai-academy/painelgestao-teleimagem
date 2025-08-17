-- Adicionar campos para identificação de tipo de cliente
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS tipo_pessoa text CHECK (tipo_pessoa IN ('PJ', 'PF')),
ADD COLUMN IF NOT EXISTS cpf text;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_pessoa ON clientes(tipo_pessoa);

-- Comentários para documentação
COMMENT ON COLUMN clientes.tipo_pessoa IS 'Tipo de pessoa: PJ (Pessoa Jurídica) ou PF (Pessoa Física)';
COMMENT ON COLUMN clientes.cpf IS 'CPF para pessoas físicas';
COMMENT ON COLUMN clientes.cnpj IS 'CNPJ para pessoas jurídicas';

-- Função para detectar tipo de documento
CREATE OR REPLACE FUNCTION public.detectar_tipo_documento(documento text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  documento_limpo text;
  tamanho integer;
BEGIN
  -- Remover caracteres especiais e espaços
  documento_limpo := regexp_replace(documento, '[^0-9]', '', 'g');
  tamanho := length(documento_limpo);
  
  -- CPF tem 11 dígitos, CNPJ tem 14 dígitos
  IF tamanho = 11 THEN
    RETURN 'PF';
  ELSIF tamanho = 14 THEN
    RETURN 'PJ';
  ELSE
    RETURN NULL; -- Documento inválido
  END IF;
END;
$function$;

-- Trigger para auto-classificar tipo de pessoa
CREATE OR REPLACE FUNCTION public.classificar_tipo_pessoa()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Classificar automaticamente baseado nos documentos fornecidos
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' THEN
    NEW.tipo_pessoa := 'PJ';
    -- Garantir que CPF está vazio para PJ
    NEW.cpf := NULL;
  ELSIF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    NEW.tipo_pessoa := 'PF';
    -- Garantir que CNPJ está vazio para PF
    NEW.cnpj := NULL;
  ELSE
    -- Se nenhum documento, tentar detectar pelo campo que foi preenchido
    IF NEW.cnpj IS NOT NULL AND detectar_tipo_documento(NEW.cnpj) = 'PF' THEN
      -- Usuário colocou CPF no campo CNPJ por engano
      NEW.cpf := NEW.cnpj;
      NEW.cnpj := NULL;
      NEW.tipo_pessoa := 'PF';
    ELSIF NEW.cnpj IS NOT NULL AND detectar_tipo_documento(NEW.cnpj) = 'PJ' THEN
      NEW.tipo_pessoa := 'PJ';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_classificar_tipo_pessoa ON clientes;
CREATE TRIGGER trigger_classificar_tipo_pessoa
  BEFORE INSERT OR UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION classificar_tipo_pessoa();