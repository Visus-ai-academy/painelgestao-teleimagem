-- Testar aplicação manual das regras v002/v003
-- Primeiro vamos aplicar as regras nos dados existentes para validar

-- Verificar dados antes (apenas para log)
SELECT 'ANTES' as momento, arquivo_fonte, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE "DATA_REALIZACAO" >= '2025-06-01') as v003_violacoes,
  COUNT(*) FILTER (WHERE "DATA_LAUDO" < '2025-06-08' OR "DATA_LAUDO" > '2025-07-07') as v002_violacoes
FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
GROUP BY arquivo_fonte;

-- APLICAR REGRA V003: Excluir registros com DATA_REALIZACAO >= 01/06/2025
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND "DATA_REALIZACAO" >= '2025-06-01';

-- APLICAR REGRA V002: Excluir registros com DATA_LAUDO fora da janela 08/06/2025 - 07/07/2025
DELETE FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND ("DATA_LAUDO" < '2025-06-08' OR "DATA_LAUDO" > '2025-07-07');

-- Verificar resultado (apenas para log)
SELECT 'DEPOIS' as momento, arquivo_fonte, 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE "DATA_REALIZACAO" >= '2025-06-01') as v003_violacoes,
  COUNT(*) FILTER (WHERE "DATA_LAUDO" < '2025-06-08' OR "DATA_LAUDO" > '2025-07-07') as v002_violacoes
FROM volumetria_mobilemed 
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
GROUP BY arquivo_fonte;

-- Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'APLICACAO_MANUAL_V002_V003', 'volumetria_padrao_retroativo', 
        jsonb_build_object('teste_manual', true, 'periodo_referencia', 'jun/25'), 
        'admin', 'critical');