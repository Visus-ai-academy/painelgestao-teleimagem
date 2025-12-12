
-- REMOVER TRIGGERS DE TIPIFICAÇÃO AUTOMÁTICA
-- Esta migration remove triggers que aplicam tipificação incorretamente

-- 1. Desabilitar o trigger trigger_aplicar_regra_f007 que aplica NC-NF automaticamente
DROP TRIGGER IF EXISTS trigger_aplicar_regra_f007 ON volumetria_mobilemed;

-- 2. Recriar a função aplicar_regra_f007_medicina_interna SEM aplicar tipo_faturamento
CREATE OR REPLACE FUNCTION aplicar_regra_f007_medicina_interna()
RETURNS TRIGGER AS $$
BEGIN
  -- REGRA F007 DESATIVADA - Tipificação será aplicada APENAS pela edge function
  -- A regra original aplicava NC-NF para Dr. Rodrigo Vaz de Lima
  -- Isso deve ser feito pela aplicar-tipificacao-faturamento
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Verificar e limpar trigger_volumetria_basico se existir
DROP TRIGGER IF EXISTS trigger_volumetria_basico ON volumetria_mobilemed;

-- 4. Verificar e limpar trigger_volumetria_processamento_completo se existir  
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

COMMENT ON FUNCTION aplicar_regra_f007_medicina_interna IS 'DESATIVADA - Tipificação deve ser aplicada apenas pela edge function aplicar-tipificacao-faturamento';
