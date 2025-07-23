-- Atualizar função para usar operation correto
CREATE OR REPLACE FUNCTION limpar_dados_volumetria(arquivos_fonte text[])
RETURNS TABLE(
    registros_removidos bigint,
    arquivos_processados text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    removed_count bigint;
BEGIN
    -- Deletar registros dos arquivos especificados
    DELETE FROM volumetria_mobilemed 
    WHERE arquivo_fonte = ANY(arquivos_fonte);
    
    -- Obter quantidade de registros removidos
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    
    -- Log da operação usando operation válido
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'DELETE', 'cleanup', 
            jsonb_build_object('removed_count', removed_count, 'arquivos_fonte', arquivos_fonte),
            'system', 'info');
    
    -- Retornar resultado
    RETURN QUERY SELECT removed_count, arquivos_fonte;
END;
$$;