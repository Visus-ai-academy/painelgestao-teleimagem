-- ERRO: Check constraint no audit_logs está bloqueando inserção
-- Vamos focar apenas na limpeza das duplicatas de preços sem log

-- 1) Identificar e remover TODAS as duplicatas de preços
WITH duplicatas_identificadas AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        cliente_id,
        UPPER(TRIM(modalidade)),
        UPPER(TRIM(especialidade)),
        UPPER(TRIM(COALESCE(categoria,'SC'))),
        UPPER(TRIM(COALESCE(prioridade,'ROTINA'))),
        COALESCE(volume_inicial, -1),
        COALESCE(volume_final, -1),
        COALESCE(tipo_preco,'normal')
      ORDER BY 
        CASE WHEN ativo = true THEN 0 ELSE 1 END,
        updated_at DESC, 
        created_at DESC
    ) AS row_num
  FROM precos_servicos
)
DELETE FROM precos_servicos
WHERE id IN (
  SELECT id 
  FROM duplicatas_identificadas 
  WHERE row_num > 1
);

-- 2) Criar índice único para prevenir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS ux_precos_servicos_unicos
ON precos_servicos (
  cliente_id,
  UPPER(TRIM(modalidade)),
  UPPER(TRIM(especialidade)),
  UPPER(TRIM(COALESCE(categoria,'SC'))),
  UPPER(TRIM(COALESCE(prioridade,'ROTINA'))),
  COALESCE(volume_inicial, -1),
  COALESCE(volume_final, -1),
  COALESCE(tipo_preco,'normal')
) WHERE ativo = true;

-- 3) Verificar resultado da limpeza
SELECT 
  'Limpeza concluída' as status,
  COUNT(*) as total_precos_restantes
FROM precos_servicos
WHERE ativo = true;