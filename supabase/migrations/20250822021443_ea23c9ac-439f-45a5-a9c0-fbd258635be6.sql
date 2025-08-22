-- Desabilitar temporariamente o trigger para identificar a causa real das exclusões
DROP TRIGGER IF EXISTS trigger_log_volumetria_deletion ON public.volumetria_mobilemed;

-- Criar versão corrigida que identifica o contexto real
CREATE OR REPLACE FUNCTION public.log_volumetria_deletion_detailed()
RETURNS TRIGGER AS $$
DECLARE
    context_info text;
    stack_trace text;
BEGIN
    -- Capturar informações do contexto
    GET DIAGNOSTICS stack_trace = PG_CONTEXT;
    
    -- Determinar o motivo real baseado no contexto
    CASE 
        WHEN stack_trace LIKE '%aplicar_filtro_periodo_atual%' THEN
            context_info := 'FILTRO_PERIODO_AUTOMATICO';
        WHEN stack_trace LIKE '%aplicar_regras%' THEN
            context_info := 'REGRAS_NEGOCIO_AUTOMATICO';
        WHEN stack_trace LIKE '%limpar%' THEN
            context_info := 'LIMPEZA_MANUAL_REAL';
        ELSE
            context_info := 'EXCLUSAO_CONTEXTO_DESCONHECIDO';
    END CASE;
    
    -- Salvar com contexto correto
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
        1,
        row_to_json(OLD),
        context_info,
        format('Registro excluído - Contexto: %s | Stack: %s', context_info, substring(stack_trace, 1, 200)),
        now()
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';