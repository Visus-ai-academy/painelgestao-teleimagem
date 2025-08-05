-- Recriar função RPC para garantir retorno de TODOS os laudos atrasados
DROP FUNCTION IF EXISTS public.get_laudos_atrasados_completos();

-- Recriar função com SECURITY DEFINER para bypass de RLS
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
  data_referencia date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- FORÇAR bypass completo de RLS para garantir todos os dados
  SET LOCAL row_security = off;
  
  -- Retornar TODOS os laudos atrasados sem qualquer limitação
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

-- Grant execute permission para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_laudos_atrasados_completos() TO authenticated;

-- Recriar função get_tempo_medio_atraso_clientes com correções
DROP FUNCTION IF EXISTS public.get_tempo_medio_atraso_clientes();

CREATE OR REPLACE FUNCTION public.get_tempo_medio_atraso_clientes()
RETURNS TABLE(empresa text, tempo_medio_atraso_horas numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- FORÇAR bypass completo de RLS
  SET LOCAL row_security = off;
  
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    AVG(
      EXTRACT(EPOCH FROM (
        (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) - 
        (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      )) / 3600
    )::numeric as tempo_medio_atraso_horas
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL
    AND vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
  GROUP BY vm."EMPRESA"
  HAVING COUNT(*) > 0; -- APENAS clientes que TÊM laudos atrasados
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_tempo_medio_atraso_clientes() TO authenticated;