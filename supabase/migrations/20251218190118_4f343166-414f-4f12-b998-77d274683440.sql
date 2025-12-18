-- Remover função verificar_e_aplicar_regras_automaticas que contém "jun/25" hardcoded
DROP FUNCTION IF EXISTS public.verificar_e_aplicar_regras_automaticas() CASCADE;

-- Remover triggers relacionados que possam estar usando a função
DROP TRIGGER IF EXISTS trigger_aplicar_regras_automaticas ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_verificar_regras ON public.volumetria_mobilemed;