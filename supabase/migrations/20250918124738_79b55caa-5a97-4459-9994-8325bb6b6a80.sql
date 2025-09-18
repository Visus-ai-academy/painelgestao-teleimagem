-- ERRO: Ainda existem duplicatas após primeira limpeza
-- Vamos fazer limpeza mais rigorosa para resolver problema das duplicatas

-- 1) Identificar e remover TODAS as duplicatas, mantendo apenas uma por cliente/combinação
WITH duplicatas_identificadas AS (
  SELECT 
    id,
    cliente_id,
    modalidade,
    especialidade, 
    categoria,
    prioridade,
    volume_inicial,
    volume_final,
    tipo_preco,
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

-- 2) Agora criar índice único (após garantir unicidade)
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

-- 3) Log da limpeza
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('precos_servicos', 'LIMPEZA_DUPLICATAS_COMPLETA', 'bulk_operation', 
        jsonb_build_object('timestamp', now(), 'operacao', 'remocao_duplicatas_rigorosa'),
        'system', 'warning');