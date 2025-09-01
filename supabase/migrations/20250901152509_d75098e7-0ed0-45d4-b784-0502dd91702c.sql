-- Create triggers for automatic rule application on volumetria_mobilemed
-- This ensures all rules are applied automatically when data is inserted

-- Trigger for basic rule processing (cleaning, categorization, etc.)
CREATE TRIGGER trigger_aplicar_regras_completas
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_regras_completas_trigger();

-- Trigger for v002/v003 retroactive rules (period-based exclusions)
CREATE TRIGGER trigger_aplicar_regras_v002_v003
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_regras_v002_v003_trigger();

-- Trigger for client name normalization
CREATE TRIGGER trigger_normalizar_cliente
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.normalizar_cliente_trigger();

-- Trigger for doctor name normalization
CREATE TRIGGER trigger_normalizar_medico
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_normalizar_medico();

-- Trigger for automatic exam breaking/splitting
CREATE TRIGGER trigger_quebra_automatica
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_quebra_automatica();

-- Trigger for billing type classification
CREATE TRIGGER trigger_tipificacao_faturamento
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_tipificacao_faturamento();