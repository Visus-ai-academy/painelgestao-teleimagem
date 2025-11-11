-- Sincronizar cliente_nome na tabela precos_servicos com o nome_fantasia oficial dos clientes
-- Isso corrige registros que foram importados com sufixos incorretos como "- TELE"

UPDATE precos_servicos ps
SET cliente_nome = c.nome_fantasia
FROM clientes c
WHERE ps.cliente_id = c.id
  AND ps.cliente_id IS NOT NULL
  AND ps.cliente_nome != c.nome_fantasia;

-- Log de quantos registros foram atualizados
DO $$
DECLARE
  total_atualizados INTEGER;
BEGIN
  GET DIAGNOSTICS total_atualizados = ROW_COUNT;
  RAISE NOTICE '✅ % registros de preços sincronizados com nome_fantasia oficial', total_atualizados;
END $$;