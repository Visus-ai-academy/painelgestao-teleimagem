-- Criar função RPC otimizada para buscar APENAS laudos atrasados sem limitação
CREATE OR REPLACE FUNCTION public.get_laudos_atrasados_completos()
RETURNS TABLE(
  "EMPRESA" text,
  "NOME_PACIENTE" text,
  "ESTUDO_DESCRICAO" text,
  "MODALIDADE" text, 
  "ESPECIALIDADE" text,
  "CATEGORIA" text,
  "PRIORIDADE" text,
  "MEDICO" text,
  "VALORES" numeric,
  "DATA_LAUDO" date,
  "HORA_LAUDO" time without time zone,
  "DATA_PRAZO" date,
  "HORA_PRAZO" time without time zone,
  "data_referencia" date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Retornar TODOS os laudos atrasados sem limitação
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    vm."NOME_PACIENTE",
    vm."ESTUDO_DESCRICAO",
    vm."MODALIDADE", 
    vm."ESPECIALIDADE",
    vm."CATEGORIA",
    vm."PRIORIDADE",
    vm."MEDICO",
    vm."VALORES"::numeric,
    vm."DATA_LAUDO",
    vm."HORA_LAUDO", 
    vm."DATA_PRAZO",
    vm."HORA_PRAZO",
    vm.data_referencia
  FROM volumetria_mobilemed vm
  WHERE vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
  ORDER BY vm.id;
END;
$function$;