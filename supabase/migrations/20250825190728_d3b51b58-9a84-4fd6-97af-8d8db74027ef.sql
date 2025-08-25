-- DESABILITAR TEMPORARIAMENTE OS TRIGGERS QUE APLICAM REGRAS DE EXCLUSÃO
-- Isso permitirá que os dados sejam inseridos sem aplicar as regras v002, v003 e v031

-- Desabilitar trigger principal de processamento
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_processamento_automatico_volumetria;

-- Desabilitar triggers de data de referência que podem estar causando exclusões
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER set_data_referencia_trigger;
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_data_referencia;

-- Log da operação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'DISABLE_TRIGGERS', 'temp_test', 
        jsonb_build_object(
          'triggers_desabilitados', ARRAY[
            'trigger_processamento_automatico_volumetria',
            'set_data_referencia_trigger', 
            'trigger_data_referencia'
          ],
          'motivo', 'Teste de inserção de dados - desabilitar regras v002/v003/v031 temporariamente'
        ),
        'system', 'warning');