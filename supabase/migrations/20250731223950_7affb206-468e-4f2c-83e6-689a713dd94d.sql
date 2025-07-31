-- Primeiro remover a função existente
DROP FUNCTION IF EXISTS public.get_volumetria_aggregated_stats();

-- Recriar a função com tipos corretos
CREATE OR REPLACE FUNCTION public.get_volumetria_aggregated_stats()
 RETURNS TABLE(arquivo_fonte text, total_records numeric, records_with_value numeric, records_zeroed numeric, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm.arquivo_fonte,
    COUNT(*)::numeric as total_records,
    COUNT(*) FILTER (WHERE vm."VALORES" > 0)::numeric as records_with_value,
    COUNT(*) FILTER (WHERE vm."VALORES" = 0 OR vm."VALORES" IS NULL)::numeric as records_zeroed,
    COALESCE(SUM(vm."VALORES"), 0)::numeric as total_value
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN (
    'volumetria_padrao', 
    'volumetria_fora_padrao', 
    'volumetria_padrao_retroativo', 
    'volumetria_fora_padrao_retroativo',
    'volumetria_onco_padrao',
    'data_laudo',
    'data_exame'
  )
  GROUP BY vm.arquivo_fonte;
END;
$function$