-- 🔐 CORREÇÃO SEARCH_PATH FUNÇÕES PRINCIPAIS - ETAPA 2

-- Funções mais críticas de volumetria e stats
CREATE OR REPLACE FUNCTION public.get_volumetria_stats(p_empresa text DEFAULT NULL::text, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
RETURNS TABLE(total_exames bigint, total_registros bigint, total_atrasados bigint, percentual_atraso numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(v."VALORES"), 0)::BIGINT as total_exames,
        COUNT(*)::BIGINT as total_registros,
        COUNT(*) FILTER (WHERE 
            v."DATA_LAUDO" IS NOT NULL AND v."HORA_LAUDO" IS NOT NULL AND 
            v."DATA_PRAZO" IS NOT NULL AND v."HORA_PRAZO" IS NOT NULL AND
            (v."DATA_LAUDO"::timestamp + v."HORA_LAUDO"::time) > (v."DATA_PRAZO"::timestamp + v."HORA_PRAZO"::time)
        )::BIGINT as total_atrasados,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE 
                    v."DATA_LAUDO" IS NOT NULL AND v."HORA_LAUDO" IS NOT NULL AND 
                    v."DATA_PRAZO" IS NOT NULL AND v."HORA_PRAZO" IS NOT NULL AND
                    (v."DATA_LAUDO"::timestamp + v."HORA_LAUDO"::time) > (v."DATA_PRAZO"::timestamp + v."HORA_PRAZO"::time)
                ) * 100.0 / COUNT(*)), 2)
            ELSE 0
        END as percentual_atraso
    FROM volumetria_mobilemed v
    WHERE (p_empresa IS NULL OR v."EMPRESA" = p_empresa)
      AND (p_data_inicio IS NULL OR v.data_referencia >= p_data_inicio)
      AND (p_data_fim IS NULL OR v.data_referencia <= p_data_fim)
      AND v."VALORES" > 0;
END;
$function$;

-- Função de limpeza dos preços
CREATE OR REPLACE FUNCTION public.limpar_todos_precos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM precos_servicos;
  UPDATE contratos_clientes SET tem_precos_configurados = false;
END;
$$;

-- Funções de validação
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  digits TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
BEGIN
  digits := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  IF length(digits) != 11 THEN
    RETURN FALSE;
  END IF;
  
  IF digits ~ '^(.)\1{10}$' THEN
    RETURN FALSE;
  END IF;
  
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(digits, i, 1)::INTEGER * (11 - i));
  END LOOP;
  
  sum1 := ((sum1 * 10) % 11);
  IF sum1 = 10 THEN sum1 := 0; END IF;
  
  IF sum1 != substring(digits, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(digits, i, 1)::INTEGER * (12 - i));
  END LOOP;
  
  sum2 := ((sum2 * 10) % 11);
  IF sum2 = 10 THEN sum2 := 0; END IF;
  
  RETURN sum2 = substring(digits, 11, 1)::INTEGER;
END;
$function$;