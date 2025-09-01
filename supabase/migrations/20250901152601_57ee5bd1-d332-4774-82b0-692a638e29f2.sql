-- Drop existing triggers if they exist (cleanup)
DROP TRIGGER IF EXISTS trigger_aplicar_regras_completas ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_regras_v002_v003 ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_normalizar_cliente ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_normalizar_medico ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_quebra_automatica ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_tipificacao_faturamento ON public.volumetria_mobilemed;

-- Create triggers for automatic rule application on volumetria_mobilemed
-- Trigger 1: Basic rule processing (cleaning, categorization)
CREATE TRIGGER trigger_aplicar_regras_completas
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_regras_completas_trigger();

-- Trigger 2: v002/v003 retroactive rules (period-based exclusions)  
CREATE TRIGGER trigger_aplicar_regras_v002_v003
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_regras_v002_v003_trigger();

-- Trigger 3: Client name normalization
CREATE TRIGGER trigger_normalizar_cliente
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.normalizar_cliente_trigger();

-- Trigger 4: Doctor name normalization
CREATE TRIGGER trigger_normalizar_medico
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_normalizar_medico();

-- Trigger 5: Automatic exam breaking/splitting
CREATE TRIGGER trigger_quebra_automatica
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_quebra_automatica();

-- Trigger 6: Billing type classification
CREATE TRIGGER trigger_tipificacao_faturamento
    BEFORE INSERT ON public.volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION public.aplicar_tipificacao_faturamento();