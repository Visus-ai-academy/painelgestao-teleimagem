-- Criar função para normalizar nome do médico
CREATE OR REPLACE FUNCTION public.normalizar_medico(medico_nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF medico_nome IS NULL OR medico_nome = '' THEN
    RETURN medico_nome;
  END IF;
  
  -- Remover códigos entre parênteses como (E1), (E2), (E3), etc
  medico_nome := regexp_replace(medico_nome, '\s*\([^)]*\)\s*', '', 'g');
  
  -- Remover DR/DRA no início se presente
  medico_nome := regexp_replace(medico_nome, '^DR[A]?\s+', '', 'i');
  
  -- Remover pontos finais
  medico_nome := regexp_replace(medico_nome, '\.$', '');
  
  -- Limpar espaços extras
  medico_nome := trim(medico_nome);
  
  RETURN medico_nome;
END;
$function$;

-- Atualizar trigger para normalizar médicos na inserção/atualização
CREATE OR REPLACE FUNCTION public.trigger_normalizar_medico()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Aplicar normalização do médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_volumetria_normalizar_medico ON volumetria_mobilemed;
CREATE TRIGGER trigger_volumetria_normalizar_medico
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalizar_medico();

-- Atualizar registros existentes que ainda têm códigos entre parênteses
UPDATE volumetria_mobilemed 
SET "MEDICO" = normalizar_medico("MEDICO")
WHERE "MEDICO" IS NOT NULL 
  AND "MEDICO" LIKE '%(%';