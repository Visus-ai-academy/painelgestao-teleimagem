-- Inserir registros de teste para demonstrar o painel de status
-- Isso simula uploads recentes de todos os tipos para mostrar que o sistema funciona

INSERT INTO processamento_uploads (
  arquivo_nome, tipo_arquivo, tipo_dados, status, 
  registros_processados, registros_inseridos, registros_atualizados, registros_erro,
  created_at
) VALUES 
-- Modalidades
('modalidades_teste.xlsx', 'modalidades', 'incremental', 'concluido', 15, 12, 3, 0, NOW() - INTERVAL '2 hours'),
-- Especialidades  
('especialidades_teste.xlsx', 'especialidades', 'incremental', 'concluido', 25, 20, 5, 0, NOW() - INTERVAL '3 hours'),
-- Prioridades
('prioridades_teste.xlsx', 'prioridades', 'incremental', 'concluido', 8, 6, 2, 0, NOW() - INTERVAL '4 hours'),
-- Preços de Serviços
('precos_servicos_teste.xlsx', 'precos_servicos', 'incremental', 'concluido', 120, 80, 35, 5, NOW() - INTERVAL '5 hours'),
-- Regras de Exclusão
('regras_exclusao_teste.xlsx', 'regras_exclusao', 'incremental', 'concluido', 45, 40, 5, 0, NOW() - INTERVAL '6 hours'),
-- Repasse Médico
('repasse_medico_teste.xlsx', 'repasse_medico', 'incremental', 'concluido', 60, 55, 5, 0, NOW() - INTERVAL '7 hours'),
-- Categorias de Exame
('categorias_exame_teste.xlsx', 'categorias_exame', 'incremental', 'concluido', 18, 15, 3, 0, NOW() - INTERVAL '8 hours');