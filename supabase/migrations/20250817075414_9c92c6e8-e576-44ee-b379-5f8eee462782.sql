-- Testar aplicação manual de quebra para um arquivo específico
DO $$
DECLARE
    test_arquivo_fonte TEXT := 'volumetria_padrao';
    test_result JSONB;
BEGIN
    -- Invocar a função de quebra diretamente
    SELECT content INTO test_result 
    FROM http((
        'POST',
        current_setting('app.settings.supabase_url') || '/functions/v1/aplicar-regras-quebra-exames',
        ARRAY[
            http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
            http_header('Content-Type', 'application/json')
        ],
        jsonb_build_object('arquivo_fonte', test_arquivo_fonte)::text
    ));
    
    RAISE NOTICE 'Resultado da quebra: %', test_result;
END $$;