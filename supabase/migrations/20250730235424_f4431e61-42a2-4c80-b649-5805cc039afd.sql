-- Criar função para estatísticas agregadas de volumetria
CREATE OR REPLACE FUNCTION public.get_volumetria_aggregated_stats()
RETURNS TABLE(
  arquivo_fonte TEXT,
  total_records BIGINT,
  records_with_value BIGINT,
  records_zeroed BIGINT,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'volumetria_fora_padrao_retroativo'
  )
  GROUP BY vm.arquivo_fonte;
END;
$$;