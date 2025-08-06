-- Limpar duplicatas na tabela precos_servicos
-- Manter apenas o registro mais recente de cada combinação única

-- 1. Criar tabela temporária com registros únicos (mais recentes)
CREATE TEMP TABLE precos_servicos_unicos AS
SELECT DISTINCT ON (cliente_id, modalidade, especialidade, prioridade, categoria, valor_base, volume_inicial, volume_final, volume_total)
  id,
  cliente_id,
  modalidade,
  especialidade,
  prioridade,
  categoria,
  valor_base,
  valor_urgencia,
  volume_inicial,
  volume_final,
  volume_total,
  considera_prioridade_plantao,
  tipo_preco,
  aplicar_legado,
  aplicar_incremental,
  ativo,
  created_at,
  created_by,
  updated_at
FROM precos_servicos
ORDER BY cliente_id, modalidade, especialidade, prioridade, categoria, valor_base, volume_inicial, volume_final, volume_total, created_at DESC;

-- 2. Contar registros antes da limpeza
DO $$
DECLARE
  total_antes INTEGER;
  total_unicos INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_antes FROM precos_servicos;
  SELECT COUNT(*) INTO total_unicos FROM precos_servicos_unicos;
  
  RAISE NOTICE 'LIMPEZA PREÇOS SERVIÇOS - Antes: % registros, Únicos: % registros, Duplicatas a remover: %', 
    total_antes, total_unicos, total_antes - total_unicos;
END $$;

-- 3. Backup dos dados originais (opcional - comentado para não ocupar espaço)
-- CREATE TABLE precos_servicos_backup_duplicatas AS SELECT * FROM precos_servicos;

-- 4. Limpar tabela original
TRUNCATE TABLE precos_servicos;

-- 5. Inserir apenas registros únicos
INSERT INTO precos_servicos (
  id, cliente_id, modalidade, especialidade, prioridade, categoria,
  valor_base, valor_urgencia, volume_inicial, volume_final, volume_total,
  considera_prioridade_plantao, tipo_preco, aplicar_legado, aplicar_incremental,
  ativo, created_at, created_by, updated_at
)
SELECT 
  id, cliente_id, modalidade, especialidade, prioridade, categoria,
  valor_base, valor_urgencia, volume_inicial, volume_final, volume_total,
  considera_prioridade_plantao, tipo_preco, aplicar_legado, aplicar_incremental,
  ativo, created_at, created_by, updated_at
FROM precos_servicos_unicos;

-- 6. Verificar resultado final
DO $$
DECLARE
  total_final INTEGER;
  total_duplicatas_restantes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_final FROM precos_servicos;
  
  SELECT COUNT(*) - COUNT(DISTINCT (cliente_id, modalidade, especialidade, prioridade, categoria, valor_base, volume_inicial, volume_final, volume_total))
  INTO total_duplicatas_restantes 
  FROM precos_servicos;
  
  RAISE NOTICE 'LIMPEZA CONCLUÍDA - Total final: % registros, Duplicatas restantes: %', 
    total_final, total_duplicatas_restantes;
END $$;

-- 7. Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('precos_servicos', 'CLEANUP_DUPLICATES', 'bulk', 
        jsonb_build_object('action', 'remove_duplicates', 'timestamp', now()),
        'system', 'info');