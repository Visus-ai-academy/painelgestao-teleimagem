-- Corrigir os registros de upload com os dados reais calculados
UPDATE processamento_uploads SET
  registros_processados = 67893,
  registros_inseridos = 67891,
  registros_atualizados = 0,
  registros_erro = 2
WHERE tipo_arquivo = 'volumetria_padrao';

UPDATE processamento_uploads SET
  registros_processados = 6390,
  registros_inseridos = 6390,
  registros_atualizados = 0,
  registros_erro = 0
WHERE tipo_arquivo = 'volumetria_padrao_retroativo';

UPDATE processamento_uploads SET
  registros_processados = 108,
  registros_inseridos = 0,
  registros_atualizados = 0,
  registros_erro = 108
WHERE tipo_arquivo = 'volumetria_fora_padrao';

UPDATE processamento_uploads SET
  registros_processados = 2,
  registros_inseridos = 0,
  registros_atualizados = 0,
  registros_erro = 2
WHERE tipo_arquivo = 'volumetria_fora_padrao_retroativo';