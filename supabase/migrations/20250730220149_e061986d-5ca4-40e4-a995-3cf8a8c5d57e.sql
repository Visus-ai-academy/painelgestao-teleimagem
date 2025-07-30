-- Adicionar logs para Prioridades e Quebra de Exames

-- Prioridades
INSERT INTO processamento_uploads (
  tipo_arquivo,
  arquivo_nome,
  status,
  registros_processados,
  registros_inseridos,
  registros_atualizados,
  registros_erro,
  tipo_dados,
  created_at
)
SELECT 
  'prioridades',
  'PRIORIDADE.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM prioridades
WHERE ativo = true
HAVING COUNT(*) > 0;

-- Quebra de Exames (se houver dados)
INSERT INTO processamento_uploads (
  tipo_arquivo,
  arquivo_nome,
  status,
  registros_processados,
  registros_inseridos,
  registros_atualizados,
  registros_erro,
  tipo_dados,
  created_at
)
SELECT 
  'quebra_exames',
  'QUEBRA EXAME.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM regras_quebra_exames
HAVING COUNT(*) > 0;