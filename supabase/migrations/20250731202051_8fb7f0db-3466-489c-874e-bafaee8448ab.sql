-- Limpar uploads que falharam (status processando por mais de 10 minutos)
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"error": "Timeout - Upload cancelado automaticamente", "tempo_limite_excedido": true}'
WHERE status = 'processando' 
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Adicionar campo para controlar período/lote de upload
ALTER TABLE volumetria_mobilemed ADD COLUMN IF NOT EXISTS lote_upload TEXT;
ALTER TABLE volumetria_mobilemed ADD COLUMN IF NOT EXISTS periodo_referencia TEXT;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_volumetria_arquivo_fonte ON volumetria_mobilemed(arquivo_fonte);
CREATE INDEX IF NOT EXISTS idx_volumetria_lote_upload ON volumetria_mobilemed(lote_upload);
CREATE INDEX IF NOT EXISTS idx_volumetria_periodo ON volumetria_mobilemed(periodo_referencia);