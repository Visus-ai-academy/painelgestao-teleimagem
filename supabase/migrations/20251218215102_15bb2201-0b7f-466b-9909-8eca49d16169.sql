
-- =====================================================
-- REMOÇÃO DAS FUNÇÕES COM DATAS HARDCODED DE JUNHO/2025
-- =====================================================

-- 1. Remover triggers associados (se existirem)
DROP TRIGGER IF EXISTS trigger_aplicar_v002_v003 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_v031 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_regras_v002_v003 ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_regra_v031 ON volumetria_mobilemed;

-- 2. Remover as funções com datas hardcoded (CASCADE remove dependências)
DROP FUNCTION IF EXISTS aplicar_regras_v002_v003_trigger() CASCADE;
DROP FUNCTION IF EXISTS aplicar_regra_v031_trigger() CASCADE;
