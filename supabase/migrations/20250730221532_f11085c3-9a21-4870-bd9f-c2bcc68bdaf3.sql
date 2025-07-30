-- Criar registros de upload para os dados de volumetria existentes
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
  arquivo_fonte as tipo_arquivo,
  CASE 
    WHEN arquivo_fonte = 'volumetria_padrao' THEN 'Volumetria_Padrao.xlsx'
    WHEN arquivo_fonte = 'volumetria_fora_padrao' THEN 'Volumetria_Fora_Padrao.xlsx'
    WHEN arquivo_fonte = 'volumetria_padrao_retroativo' THEN 'Volumetria_Padrao_Retroativo.xlsx'
    WHEN arquivo_fonte = 'volumetria_fora_padrao_retroativo' THEN 'Volumetria_Fora_Padrao_Retroativo.xlsx'
    WHEN arquivo_fonte = 'volumetria_onco_padrao' THEN 'Volumetria_Onco_Padrao.xlsx'
    ELSE 'Upload_' || arquivo_fonte || '.xlsx'
  END as arquivo_nome,
  'concluido' as status,
  COUNT(*) as registros_processados,
  COUNT(CASE WHEN "VALORES" IS NOT NULL AND "VALORES" > 0 THEN 1 END) as registros_inseridos,
  0 as registros_atualizados,
  0 as registros_erro,
  'incremental' as tipo_dados,
  MAX(created_at) as created_at
FROM volumetria_mobilemed 
WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao')
GROUP BY arquivo_fonte
HAVING COUNT(*) > 0;