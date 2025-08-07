-- Criar trigger para aplicar limpeza automática de nomes de clientes na volumetria
CREATE OR REPLACE FUNCTION public.trigger_limpar_nome_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Aplicar a função de limpeza no campo EMPRESA
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para aplicar antes de inserir/atualizar na volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_limpar_nomes_volumetria ON volumetria_mobilemed;
CREATE TRIGGER trigger_limpar_nomes_volumetria
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_limpar_nome_cliente();