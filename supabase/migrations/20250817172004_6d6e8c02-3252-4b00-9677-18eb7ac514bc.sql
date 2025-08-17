-- Correção simpler para garantir que o trigger funcione corretamente
-- Vamos executar uma correção sem usar ALTER TABLE dentro do bloco anônimo

-- Primeiro, garantir que o trigger está ativo
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

CREATE TRIGGER trigger_volumetria_processamento_completo
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_volumetria_processamento_completo();

-- Executar uma correção manual simples através de um UPDATE direto
UPDATE volumetria_mobilemed 
SET 
  "CATEGORIA" = CASE 
    WHEN ("CATEGORIA" IS NULL OR "CATEGORIA" = '') THEN 
      COALESCE(
        (SELECT ce.categoria 
         FROM cadastro_exames ce 
         WHERE ce.nome = volumetria_mobilemed."ESTUDO_DESCRICAO" 
         AND ce.ativo = true 
         AND ce.categoria IS NOT NULL 
         AND ce.categoria != '' 
         LIMIT 1),
        'SC'
      )
    ELSE "CATEGORIA"
  END,
  "ESPECIALIDADE" = CASE 
    WHEN ("ESPECIALIDADE" IS NULL OR "ESPECIALIDADE" = '') THEN 
      COALESCE(
        (SELECT ce.especialidade 
         FROM cadastro_exames ce 
         WHERE ce.nome = volumetria_mobilemed."ESTUDO_DESCRICAO" 
         AND ce.ativo = true 
         AND ce.especialidade IS NOT NULL 
         AND ce.especialidade != '' 
         LIMIT 1),
        'GERAL'
      )
    ELSE "ESPECIALIDADE"
  END,
  tipo_faturamento = CASE 
    WHEN (tipo_faturamento IS NULL OR tipo_faturamento = '') THEN 
      CASE 
        WHEN "CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN 'oncologia'
        WHEN "PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN 'urgencia'
        WHEN "MODALIDADE" IN ('CT', 'MR') THEN 'alta_complexidade'
        ELSE 'padrao'
      END
    ELSE tipo_faturamento
  END,
  data_referencia = CASE 
    WHEN data_referencia IS NULL THEN "DATA_REALIZACAO"
    ELSE data_referencia
  END,
  processamento_pendente = CASE 
    WHEN EXISTS (
      SELECT 1 FROM regras_quebra_exames 
      WHERE exame_original = volumetria_mobilemed."ESTUDO_DESCRICAO" 
      AND ativo = true
    ) THEN true
    ELSE false
  END,
  updated_at = now()
WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
AND (
  "CATEGORIA" IS NULL OR "CATEGORIA" = '' OR
  tipo_faturamento IS NULL OR tipo_faturamento = '' OR
  "ESPECIALIDADE" IS NULL OR "ESPECIALIDADE" = '' OR
  data_referencia IS NULL OR
  processamento_pendente IS NULL
);

-- Log do resultado
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CORRECAO_AUTOMATICA_TRIGGER', 
        'BULK_OPERATION',
        jsonb_build_object(
          'trigger_recriado', true,
          'dados_corrigidos', true,
          'timestamp', now()
        ),
        'system', 'info');