-- Criar função para interceptar exclusões na volumetria_mobilemed
CREATE OR REPLACE FUNCTION public.log_volumetria_deletion()
RETURNS TRIGGER AS $$
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
        COALESCE(OLD.id::text, 'unknown'),
        row_to_json(OLD),
        'REGISTRO_EXCLUIDO_PROCESSAMENTO',
        'Registro excluído durante processamento de regras de negócio',
        now()
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para capturar todas as exclusões
DROP TRIGGER IF EXISTS trigger_log_volumetria_deletion ON public.volumetria_mobilemed;
CREATE TRIGGER trigger_log_volumetria_deletion
    BEFORE DELETE ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.log_volumetria_deletion();