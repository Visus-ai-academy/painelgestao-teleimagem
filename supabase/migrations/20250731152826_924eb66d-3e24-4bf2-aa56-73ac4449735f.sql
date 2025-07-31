-- Atualizar função para fazer refresh da view materializada sem CONCURRENTLY
CREATE OR REPLACE FUNCTION public.refresh_volumetria_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW mv_volumetria_dashboard;
END;
$function$;

-- Executar refresh da view materializada agora
SELECT refresh_volumetria_dashboard();