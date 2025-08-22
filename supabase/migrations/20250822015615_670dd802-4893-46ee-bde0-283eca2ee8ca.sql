-- Corrigir função do trigger para usar tipos corretos
CREATE OR REPLACE FUNCTION public.log_volumetria_deletion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Salvar registro que está sendo deletado na tabela de rejeições
    INSERT INTO public.registros_rejeitados_processamento (
        arquivo_fonte,
        lote_upload,
        linha_original,
        dados_originais,
        motivo_rejeicao,
        detalhes_erro,
        created_at
    ) VALUES (
        COALESCE(OLD.arquivo_fonte, 'unknown'),
        COALESCE(OLD.lote_upload, 'unknown'),
        1, -- Usar número fixo já que não temos linha original real para limpezas
        row_to_json(OLD),
        'REGISTRO_EXCLUIDO_LIMPEZA',
        'Registro excluído durante limpeza manual de dados',
        now()
    );
    
    RETURN OLD;
END;
$$;