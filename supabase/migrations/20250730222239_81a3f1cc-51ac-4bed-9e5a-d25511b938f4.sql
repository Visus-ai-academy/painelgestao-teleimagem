-- Atualizar registros de upload com os dados corretos após limpeza de duplicatas

UPDATE processamento_uploads SET
  registros_processados = 33636,
  registros_inseridos = 33635,
  registros_atualizados = 0,
  registros_erro = 1
WHERE tipo_arquivo = 'volumetria_padrao';

UPDATE processamento_uploads SET
  registros_processados = 3134,
  registros_inseridos = 3134,
  registros_atualizados = 0,
  registros_erro = 0
WHERE tipo_arquivo = 'volumetria_padrao_retroativo';

UPDATE processamento_uploads SET
  registros_processados = 54,
  registros_inseridos = 0,
  registros_atualizados = 0,
  registros_erro = 54
WHERE tipo_arquivo = 'volumetria_fora_padrao';

UPDATE processamento_uploads SET
  registros_processados = 1,
  registros_inseridos = 0,
  registros_atualizados = 0,
  registros_erro = 1
WHERE tipo_arquivo = 'volumetria_fora_padrao_retroativo';