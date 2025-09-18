-- Limpar duplicatas de preços - manter apenas o mais recente de cada combinação
-- CRÍTICO: Isso resolve o problema de preços inconsistentes

-- 1. Criar tabela temporária com apenas os registros únicos (mais recentes)
CREATE TEMP TABLE precos_unicos AS
SELECT DISTINCT ON (cliente_id, modalidade, especialidade, COALESCE(categoria, 'SC'), 
                   volume_inicial, volume_final, tipo_preco) 
  *
FROM precos_servicos 
WHERE ativo = true
ORDER BY cliente_id, modalidade, especialidade, COALESCE(categoria, 'SC'),
         volume_inicial, volume_final, tipo_preco, updated_at DESC;

-- 2. Desativar todos os preços que não estão na lista única
UPDATE precos_servicos 
SET ativo = false,
    updated_at = now()
WHERE ativo = true 
  AND id NOT IN (SELECT id FROM precos_unicos);

-- 3. Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('precos_servicos', 'CLEANUP_DUPLICATES', 'bulk_operation', 
        jsonb_build_object(
          'timestamp', now(),
          'total_precos_desativados', (
            SELECT COUNT(*) 
            FROM precos_servicos 
            WHERE ativo = false 
              AND updated_at::date = CURRENT_DATE
          )
        ),
        'system', 'warning');

-- 4. Verificar resultados
SELECT 
  'Limpeza concluída' as status,
  COUNT(*) FILTER (WHERE ativo = true) as precos_ativos,
  COUNT(*) FILTER (WHERE ativo = false AND updated_at::date = CURRENT_DATE) as precos_desativados_hoje
FROM precos_servicos;