-- RESTAURAR FUNCIONAMENTO ORIGINAL - DESABILITAR TRIGGERS CONFLITANTES

-- 1. Desabilitar todos os triggers conflitantes que estão travando o upload
DROP TRIGGER IF EXISTS trigger_aplicar_regras_v002_v003 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_v002_v003 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_regras_v002_v003 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_v031 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_debug_upload ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_log_volumetria_exclusao ON volumetria_mobilemed;

-- 2. Manter apenas triggers essenciais (não conflitantes)
-- trigger_normalizar_medico - OK, não causa conflito
-- trigger_limpar_nome_cliente - OK, não causa conflito
-- trigger_aplicar_mapeamento_nome_fantasia - OK, não causa conflito

-- 3. Marcar upload atual como erro para permitir novo upload
UPDATE processamento_uploads 
SET status = 'erro',
    detalhes_erro = '{"erro":"Triggers conflitantes desabilitados - sistema restaurado para Edge Functions","regras":"Aplicação via auto-aplicar-regras-pos-upload"}'
WHERE id = 'd22ca6ab-cb6f-4a09-b99e-d329c6a329a8' 
  AND status = 'processando';

-- 4. Limpar dados órfãos do upload travado
DELETE FROM volumetria_mobilemed 
WHERE lote_upload LIKE '%d22ca6ab%';

-- 5. Limpar registros rejeitados relacionados
DELETE FROM registros_rejeitados_processamento
WHERE lote_upload LIKE '%d22ca6ab%';

-- 6. Log da restauração
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema', 'RESTAURACAO_FUNCIONAMENTO', 'triggers_disabled', 
        '{"triggers_removidos":["trigger_aplicar_regras_v002_v003","trigger_aplicar_v002_v003","trigger_regras_v002_v003","trigger_aplicar_v031","trigger_debug_upload","trigger_log_volumetria_exclusao"],"sistema":"Edge Functions restaurado","upload_limpo":"d22ca6ab-cb6f-4a09-b99e-d329c6a329a8"}',
        'system', 'info');