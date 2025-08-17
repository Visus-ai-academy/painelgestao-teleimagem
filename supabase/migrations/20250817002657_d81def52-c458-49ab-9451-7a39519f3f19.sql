-- Desabilitar triggers duplicados para evitar processamento duplo
-- Mantendo apenas o trigger essencial de updated_at

-- Desabilitar o trigger principal de processamento (duplica edge functions)
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- Desabilitar triggers específicos que duplicam processamento das edge functions  
DROP TRIGGER IF EXISTS trigger_limpar_nomes_volumetria ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_categoria ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_de_para_prioridade ON volumetria_mobilemed;

-- Manter apenas triggers essenciais do sistema
-- (updated_at e data_referencia permanecem)