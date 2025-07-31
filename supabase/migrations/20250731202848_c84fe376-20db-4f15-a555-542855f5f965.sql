-- Limpar dados de teste para permitir novo upload com tipos corretos
DELETE FROM volumetria_mobilemed WHERE created_at > '2025-07-31 20:00:00';

-- Marcar uploads de teste como erro para permitir reprocessamento
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = '{"message": "Dados removidos para correção de mapeamento de tipos"}'
WHERE created_at > '2025-07-31 20:00:00';