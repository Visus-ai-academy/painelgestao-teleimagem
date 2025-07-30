-- Limpar dados de teste da tabela volumetria_mobilemed
DELETE FROM volumetria_mobilemed;

-- Limpar logs de uploads antigos da tabela processamento_uploads 
DELETE FROM processamento_uploads WHERE created_at < NOW() - INTERVAL '1 hour';

-- Limpar tabela de valores de referência De-Para
DELETE FROM valores_referencia_de_para;