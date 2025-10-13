-- Adicionar campo linha_arquivo para diferenciar registros duplicados do Excel
ALTER TABLE precos_servicos 
ADD COLUMN IF NOT EXISTS linha_arquivo integer;

-- Remover a constraint única antiga
ALTER TABLE precos_servicos 
DROP CONSTRAINT IF EXISTS ux_precos_servicos_unicos;

-- Criar nova constraint única incluindo linha_arquivo
-- Isso permite que linhas idênticas sejam inseridas desde quetenham linha_arquivo diferente
CREATE UNIQUE INDEX IF NOT EXISTS ux_precos_servicos_unicos_com_linha
ON precos_servicos (
  COALESCE(cliente_id::text, 'NULL'),
  UPPER(TRIM(modalidade)),
  UPPER(TRIM(especialidade)),
  UPPER(TRIM(COALESCE(categoria, 'SC'))),
  UPPER(TRIM(COALESCE(prioridade, 'ROTINA'))),
  COALESCE(volume_inicial, -1),
  COALESCE(volume_final, -1),
  COALESCE(tipo_preco, 'normal'),
  COALESCE(linha_arquivo, -1)
);

-- Comentário explicativo
COMMENT ON COLUMN precos_servicos.linha_arquivo IS 'Número da linha no arquivo Excel de origem, permite identificar duplicatas exatas';
