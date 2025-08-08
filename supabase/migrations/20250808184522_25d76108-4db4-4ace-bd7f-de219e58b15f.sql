-- Fix get_volumetria_aggregated_stats to include all file types and count zeroed as (VALORES = 0 OR VALORES IS NULL)
-- and to sum values safely considering uppercase quoted column names.

create or replace function public.get_volumetria_aggregated_stats()
returns table (
  arquivo_fonte text,
  total_records bigint,
  records_with_value bigint,
  records_zeroed bigint,
  total_value numeric
)
language sql
stable
as $$
  select
    arquivo_fonte,
    count(*) as total_records,
    count(*) filter (where coalesce("VALORES", 0) > 0) as records_with_value,
    count(*) filter (where "VALORES" is null or "VALORES" = 0) as records_zeroed,
    coalesce(sum(coalesce("VALORES", 0)), 0) as total_value
  from public.volumetria_mobilemed
  where arquivo_fonte in (
    'volumetria_padrao',
    'volumetria_fora_padrao',
    'volumetria_padrao_retroativo',
    'volumetria_fora_padrao_retroativo',
    'volumetria_onco_padrao'
  )
  group by arquivo_fonte
  order by arquivo_fonte
$$;