-- Corrigir dados existentes preenchendo data_referencia baseado no arquivo_fonte
UPDATE volumetria_mobilemed 
SET data_referencia = CASE 
  WHEN arquivo_fonte LIKE '%data_laudo%' THEN "DATA_LAUDO"
  WHEN arquivo_fonte LIKE '%data_exame%' THEN "DATA_REALIZACAO" 
  ELSE "DATA_REALIZACAO" -- padrão usa data de realização
END
WHERE data_referencia IS NULL AND ("DATA_REALIZACAO" IS NOT NULL OR "DATA_LAUDO" IS NOT NULL);

-- Recriar o trigger com lógica mais robusta
CREATE OR REPLACE FUNCTION public.set_data_referencia_volumetria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Define data_referencia baseado no tipo de arquivo
  IF NEW.arquivo_fonte LIKE '%data_laudo%' AND NEW."DATA_LAUDO" IS NOT NULL THEN
    NEW.data_referencia = NEW."DATA_LAUDO";
  ELSIF NEW.arquivo_fonte LIKE '%data_exame%' AND NEW."DATA_REALIZACAO" IS NOT NULL THEN
    NEW.data_referencia = NEW."DATA_REALIZACAO";
  ELSIF NEW."DATA_REALIZACAO" IS NOT NULL THEN
    NEW.data_referencia = NEW."DATA_REALIZACAO";
  ELSIF NEW."DATA_LAUDO" IS NOT NULL THEN
    NEW.data_referencia = NEW."DATA_LAUDO";
  END IF;
  
  RETURN NEW;
END;
$function$;