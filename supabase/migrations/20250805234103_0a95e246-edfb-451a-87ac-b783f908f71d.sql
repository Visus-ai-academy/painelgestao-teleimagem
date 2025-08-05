-- Corrigir função get_tempo_medio_atraso_clientes para evitar inconsistências
CREATE OR REPLACE FUNCTION public.get_tempo_medio_atraso_clientes()
RETURNS TABLE("EMPRESA" text, tempo_medio_atraso_minutos numeric, total_laudos_atrasados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    AVG(
      EXTRACT(EPOCH FROM 
        (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) - 
        (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      ) / 60
    )::numeric as tempo_medio_atraso_minutos,
    COUNT(*)::bigint as total_laudos_atrasados
  FROM volumetria_mobilemed vm
  WHERE vm."DATA_LAUDO" IS NOT NULL 
    AND vm."HORA_LAUDO" IS NOT NULL 
    AND vm."DATA_PRAZO" IS NOT NULL 
    AND vm."HORA_PRAZO" IS NOT NULL
    AND (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
    AND vm."VALORES" > 0  -- APENAS REGISTROS COM VALORES VÁLIDOS
  GROUP BY vm."EMPRESA"
  HAVING COUNT(*) > 0  -- GARANTIR QUE SÓ RETORNA CLIENTES COM ATRASOS
  ORDER BY tempo_medio_atraso_minutos DESC;
END;
$function$;

-- Melhorar função get_volumetria_complete_data para garantir todos os dados
CREATE OR REPLACE FUNCTION public.get_volumetria_complete_data()
RETURNS TABLE("EMPRESA" text, "MODALIDADE" text, "ESPECIALIDADE" text, "MEDICO" text, "PRIORIDADE" text, "CATEGORIA" text, "VALORES" numeric, "DATA_LAUDO" date, "HORA_LAUDO" time without time zone, "DATA_PRAZO" date, "HORA_PRAZO" time without time zone, data_referencia date, "NOME_PACIENTE" text, "ESTUDO_DESCRICAO" text)
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
    vm.data_referencia,
    vm."NOME_PACIENTE",
    vm."ESTUDO_DESCRICAO"
  FROM volumetria_mobilemed vm
  ORDER BY vm.id;
END;
$function$;