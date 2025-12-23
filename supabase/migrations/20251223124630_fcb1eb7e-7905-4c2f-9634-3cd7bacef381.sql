-- Limpar jobs travados (mais de 30 minutos sem conclusão)
UPDATE processamento_regras_log 
SET 
  status = 'erro',
  erro = 'Timeout: job cancelado automaticamente após mais de 30 minutos',
  completed_at = NOW()
WHERE status = 'processando' 
  AND started_at < NOW() - INTERVAL '30 minutes';

-- Criar índice para melhorar performance das queries de update
CREATE INDEX IF NOT EXISTS idx_volumetria_arquivo_estudo ON volumetria_mobilemed(arquivo_fonte, "ESTUDO_DESCRICAO");
CREATE INDEX IF NOT EXISTS idx_volumetria_arquivo_empresa ON volumetria_mobilemed(arquivo_fonte, "EMPRESA");
CREATE INDEX IF NOT EXISTS idx_volumetria_arquivo_modalidade ON volumetria_mobilemed(arquivo_fonte, "MODALIDADE");