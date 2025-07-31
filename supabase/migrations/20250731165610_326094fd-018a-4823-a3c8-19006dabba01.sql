-- Cancelar uploads travados
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload cancelado - sistema corrigido', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE status = 'processando';

-- Inserir um registro de teste na tabela volumetria_mobilemed
INSERT INTO volumetria_mobilemed (
  "EMPRESA", 
  "NOME_PACIENTE", 
  arquivo_fonte, 
  "VALORES",
  "MODALIDADE",
  "ESPECIALIDADE",
  "DATA_LAUDO",
  data_referencia
) VALUES (
  'TESTE EMPRESA', 
  'TESTE PACIENTE', 
  'volumetria_padrao', 
  100,
  'RX',
  'RADIOLOGIA',
  '2025-07-31',
  '2025-07-31'
);

-- Verificar se foi inserido
SELECT COUNT(*) as total_records FROM volumetria_mobilemed;