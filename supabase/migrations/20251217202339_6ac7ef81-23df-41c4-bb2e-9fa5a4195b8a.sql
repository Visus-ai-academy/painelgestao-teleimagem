-- Atualizar trigger_regras_basicas removendo seções conflitantes com edge functions
-- Removido: Categoria fallback 'SC', Especialidade fallback 'GERAL', De-Para Prioridades fallback 'normal', Tipificação faturamento
-- Mantido: Limpeza nome cliente, Normalização médico, Correções modalidade, De-Para valores zerados, Garantir data_referencia

CREATE OR REPLACE FUNCTION public.aplicar_regras_basicas_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_medico_normalizado TEXT;
    v_valor_referencia NUMERIC;
BEGIN
    -- =====================================================
    -- SEÇÃO 1: LIMPEZA NOME CLIENTE (MANTIDO)
    -- =====================================================
    IF NEW."EMPRESA" IS NOT NULL THEN
        NEW."EMPRESA" := UPPER(TRIM(
            REGEXP_REPLACE(
                REGEXP_REPLACE(NEW."EMPRESA", '\s+', ' ', 'g'),
                '[^\w\s]', '', 'g'
            )
        ));
    END IF;

    -- =====================================================
    -- SEÇÃO 2: NORMALIZAÇÃO MÉDICO (MANTIDO)
    -- =====================================================
    IF NEW."MEDICO_LAUDO" IS NOT NULL THEN
        SELECT medico_nome INTO v_medico_normalizado
        FROM public.mapeamento_nomes_medicos
        WHERE nome_origem_normalizado = UPPER(TRIM(NEW."MEDICO_LAUDO"))
          AND ativo = true
        LIMIT 1;
        
        IF v_medico_normalizado IS NOT NULL THEN
            NEW."MEDICO_LAUDO" := v_medico_normalizado;
        END IF;
    END IF;

    -- =====================================================
    -- SEÇÃO 3: CORREÇÕES MODALIDADE (MANTIDO)
    -- CR/DX → RX/MG, OT → DO, BMD → DO
    -- =====================================================
    IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
        IF NEW."ESTUDO_DESCRICAO" ILIKE '%MAMOGRA%' OR 
           NEW."ESTUDO_DESCRICAO" ILIKE '%MAMA%' THEN
            NEW."MODALIDADE" := 'MG';
        ELSE
            NEW."MODALIDADE" := 'RX';
        END IF;
    END IF;

    IF NEW."MODALIDADE" = 'OT' THEN
        NEW."MODALIDADE" := 'DO';
    END IF;

    IF NEW."MODALIDADE" = 'BMD' THEN
        NEW."MODALIDADE" := 'DO';
    END IF;

    -- =====================================================
    -- SEÇÃO 4: CATEGORIA DO CADASTRO - REMOVIDO
    -- (Agora tratado exclusivamente pela edge function v011)
    -- =====================================================

    -- =====================================================
    -- SEÇÃO 5: ESPECIALIDADE DO CADASTRO - REMOVIDO
    -- (Agora tratado exclusivamente pelas edge functions v007/v031)
    -- =====================================================

    -- =====================================================
    -- SEÇÃO 6: DE-PARA PRIORIDADES - REMOVIDO
    -- (Agora tratado exclusivamente pelas edge functions v008/v009)
    -- =====================================================

    -- =====================================================
    -- SEÇÃO 7: DE-PARA VALORES ZERADOS (MANTIDO)
    -- =====================================================
    IF (NEW."VALOR" IS NULL OR NEW."VALOR" = 0) AND NEW."ESTUDO_DESCRICAO" IS NOT NULL THEN
        SELECT valor_referencia INTO v_valor_referencia
        FROM public.valores_referencia_de_para
        WHERE nome_exame_origem = NEW."ESTUDO_DESCRICAO"
          AND ativo = true
        LIMIT 1;
        
        IF v_valor_referencia IS NOT NULL AND v_valor_referencia > 0 THEN
            NEW."VALOR" := v_valor_referencia;
        END IF;
    END IF;

    -- =====================================================
    -- SEÇÃO 8: TIPIFICAÇÃO FATURAMENTO - REMOVIDO
    -- (Agora tratado exclusivamente pela edge function aplicar-tipificacao-faturamento)
    -- =====================================================

    -- =====================================================
    -- SEÇÃO 9: GARANTIR DATA_REFERENCIA (MANTIDO)
    -- =====================================================
    IF NEW.periodo_referencia IS NOT NULL AND NEW.data_referencia IS NULL THEN
        NEW.data_referencia := TO_DATE('01/' || NEW.periodo_referencia, 'DD/MM/YYYY');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;