-- Criar trigger para capturar dados reais de registros excluídos
DROP TRIGGER IF EXISTS trigger_log_volumetria_exclusao ON volumetria_mobilemed;
DROP FUNCTION IF EXISTS log_volumetria_exclusao_detalhada();

CREATE OR REPLACE FUNCTION log_volumetria_exclusao_detalhada()
RETURNS TRIGGER AS $$
DECLARE
    contexto_exclusao text;
    motivo_real text;
    detalhes_completos text;
BEGIN
    -- Determinar o contexto da exclusão baseado no call stack
    GET DIAGNOSTICS contexto_exclusao = PG_CONTEXT;
    
    -- Determinar motivo baseado no contexto
    IF contexto_exclusao LIKE '%aplicar_filtro_periodo%' THEN
        motivo_real := 'FILTRO_PERIODO_AUTOMATICO';
        detalhes_completos := format('Registro excluído por filtro de período. Data realização: %s, Data laudo: %s', 
                                   OLD."DATA_REALIZACAO", OLD."DATA_LAUDO");
    ELSIF contexto_exclusao LIKE '%aplicar_regras_exclusao%' THEN
        motivo_real := 'REGRAS_NEGOCIO_AUTOMATICO';
        detalhes_completos := format('Registro excluído por regras de negócio. Cliente: %s, Exame: %s', 
                                   OLD."EMPRESA", OLD."ESTUDO_DESCRICAO");
    ELSIF contexto_exclusao LIKE '%aplicar_validacao%' THEN
        motivo_real := 'VALIDACAO_DADOS_AUTOMATICO';
        detalhes_completos := format('Registro excluído por validação de dados. Motivo: dados inválidos ou incompletos');
    ELSE
        motivo_real := 'EXCLUSAO_PROCESSAMENTO_GERAL';
        detalhes_completos := format('Registro excluído durante processamento. Contexto: %s', 
                                   substring(contexto_exclusao, 1, 200));
    END IF;
    
    -- Salvar dados reais do registro excluído
    INSERT INTO registros_rejeitados_processamento (
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
        1, -- Linha será estimada
        row_to_json(OLD)::jsonb,
        motivo_real,
        detalhes_completos,
        now()
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que captura exclusões
CREATE TRIGGER trigger_log_volumetria_exclusao
    BEFORE DELETE ON volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION log_volumetria_exclusao_detalhada();