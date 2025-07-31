-- Atualizar a função para incluir os novos tipos retroativos
CREATE OR REPLACE FUNCTION public.get_volumetria_aggregated_stats()
 RETURNS TABLE(arquivo_fonte text, total_records bigint, records_with_value bigint, records_zeroed bigint, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm.arquivo_fonte,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE vm."VALORES" > 0) as records_with_value,
    COUNT(*) FILTER (WHERE vm."VALORES" = 0 OR vm."VALORES" IS NULL) as records_zeroed,
    COALESCE(SUM(vm."VALORES"), 0) as total_value
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