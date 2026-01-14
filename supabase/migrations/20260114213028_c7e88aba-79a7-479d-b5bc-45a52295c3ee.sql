
-- CORREÇÃO: Aplicar regra v003 - Excluir registros retroativos com DATA_REALIZACAO >= primeiro dia do mês de referência
-- Para período 2025-10, registros retroativos devem ter DATA_REALIZACAO < 2025-10-01

-- Primeiro, mover os registros para a tabela de rejeitados para auditoria
INSERT INTO registros_rejeitados_processamento (
  arquivo_fonte,
  lote_upload,
  linha_original,
  dados_originais,
  motivo_rejeicao,
  detalhes_erro,
  created_at
)
SELECT 
  arquivo_fonte,
  lote_upload,
  0,
  jsonb_build_object(
    'id', id,
    'EMPRESA', "EMPRESA",
    'ESTUDO_DESCRICAO', "ESTUDO_DESCRICAO",
    'DATA_REALIZACAO', "DATA_REALIZACAO",
    'DATA_LAUDO', "DATA_LAUDO",
    'periodo_referencia', periodo_referencia,
    'regra_aplicada', 'v003'
  ),
  'REGRA_V003_DATA_REALIZACAO_FORA_PERIODO',
  'Registro retroativo com DATA_REALIZACAO >= primeiro dia do mês de referência (2025-10-01). Para arquivos retroativos, apenas exames realizados ANTES do mês de referência devem ser considerados.',
  NOW()
FROM volumetria_mobilemed
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND periodo_referencia = '2025-10'
  AND "DATA_REALIZACAO" >= '2025-10-01';

-- Agora excluir os registros
DELETE FROM volumetria_mobilemed
WHERE arquivo_fonte = 'volumetria_padrao_retroativo'
  AND periodo_referencia = '2025-10'
  AND "DATA_REALIZACAO" >= '2025-10-01';
