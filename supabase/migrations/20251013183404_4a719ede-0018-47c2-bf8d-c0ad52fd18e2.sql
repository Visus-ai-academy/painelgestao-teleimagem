-- Remover índice único antigo que ainda causava conflito
DROP INDEX IF EXISTS public.ux_precos_servicos_unicos;

-- Recriar o índice único com linha_arquivo e como índice parcial (apenas registros ativos)
DROP INDEX IF EXISTS public.ux_precos_servicos_unicos_com_linha;
CREATE UNIQUE INDEX ux_precos_servicos_unicos_com_linha
ON public.precos_servicos (
  COALESCE(cliente_id::text, 'NULL'),
  UPPER(TRIM(modalidade)),
  UPPER(TRIM(especialidade)),
  UPPER(TRIM(COALESCE(categoria, 'SC'))),
  UPPER(TRIM(COALESCE(prioridade, 'ROTINA'))),
  COALESCE(volume_inicial, -1),
  COALESCE(volume_final, -1),
  COALESCE(tipo_preco, 'normal'),
  COALESCE(linha_arquivo, -1)
)
WHERE ativo = true;

COMMENT ON INDEX ux_precos_servicos_unicos_com_linha IS 'Garante unicidade por combinação + linha_arquivo apenas para registros ativos';