-- Restaurar logs de processamento para os cadastros baseado nos dados reais

-- Modalidades
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
  'modalidades',
  'MODALIDADE.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM modalidades 
WHERE ativo = true
HAVING COUNT(*) > 0;

-- Especialidades  
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
  'especialidades',
  'ESPECIALIDADE.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM especialidades
WHERE ativo = true
HAVING COUNT(*) > 0;

-- Categorias de Exame
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
  'categorias_exame',
  'CATEGORIA.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM categorias_exame
WHERE ativo = true
HAVING COUNT(*) > 0;

-- Cadastro de Exames
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
  'cadastro_exames',
  'CADASTRO EXAME.xlsx',
  'concluido',
  COUNT(*),
  COUNT(*),
  0,
  0,
  'incremental',
  MAX(created_at)
FROM cadastro_exames
WHERE ativo = true
HAVING COUNT(*) > 0;