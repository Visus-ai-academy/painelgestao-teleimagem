-- Fix get_volumetria_complete_data function type mismatch
DROP FUNCTION IF EXISTS public.get_volumetria_complete_data();

CREATE OR REPLACE FUNCTION public.get_volumetria_complete_data()
RETURNS TABLE(
  "EMPRESA" text, 
  "MODALIDADE" text, 
  "ESPECIALIDADE" text, 
  "MEDICO" text, 
  "PRIORIDADE" text, 
  "CATEGORIA" text, 
  "VALORES" numeric, 
  "DATA_LAUDO" date, 
  "HORA_LAUDO" time without time zone, 
  "DATA_PRAZO" date, 
  "HORA_PRAZO" time without time zone, 
  data_referencia date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Retornar TODOS os dados da volumetria sem qualquer limitação
  -- Esta função bypassa completamente as limitações do client Supabase
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    vm."MODALIDADE", 
    vm."ESPECIALIDADE",
    vm."MEDICO",
    vm."PRIORIDADE",
    vm."CATEGORIA",
    vm."VALORES"::numeric,  -- Explicit cast to numeric
    vm."DATA_LAUDO",
    vm."HORA_LAUDO", 
    vm."DATA_PRAZO",
    vm."HORA_PRAZO",
    vm.data_referencia
  FROM volumetria_mobilemed vm
  ORDER BY vm.id;
END;
$function$;