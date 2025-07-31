-- LIMPEZA COMPLETA DOS DADOS DE VOLUMETRIA E DE-PARA
-- Esta migração remove 100% dos dados relacionados aos uploads de volumetria

-- 1. Limpar TODOS os registros da tabela volumetria_mobilemed
DELETE FROM volumetria_mobilemed;

-- 2. Limpar registros de status de processamento relacionados à volumetria
DELETE FROM processamento_uploads 
WHERE tipo_arquivo IN (
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo',
  'de_para_exames',
  'valores_de_para'
);

-- 3. Limpar TODOS os registros da tabela valores_referencia_de_para (De-Para)
DELETE FROM valores_referencia_de_para;

-- 4. Limpar histórico de importações relacionadas (se a tabela existir)
DELETE FROM import_history 
WHERE file_type IN (
  'volumetria_padrao',
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo',
  'volumetria_fora_padrao_retroativo',
  'de_para_exames',
  'valores_de_para'
);

-- Log da operação de limpeza
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_limpeza_completa', 'DELETE', 'bulk_cleanup', 
        jsonb_build_object(
          'tabelas_limpas', ARRAY['volumetria_mobilemed', 'processamento_uploads', 'valores_referencia_de_para', 'import_history'],
          'data_limpeza', now(),
          'motivo', 'Limpeza completa solicitada pelo usuário'
        ),
        'system', 'info');