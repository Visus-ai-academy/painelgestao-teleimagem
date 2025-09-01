-- Limpar triggers duplicados e deixar apenas o sistema coordenado

-- 1. Remover triggers antigos que duplicam funcionalidade
DROP TRIGGER IF EXISTS trigger_aplicar_regras_completas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_volumetria_basico ON volumetria_mobilemed;

-- 2. Manter apenas os triggers necessários:
-- trigger_regras_basicas (BEFORE INSERT - regras básicas)
-- trigger_aplicar_v002_v003 (BEFORE INSERT - v002/v003 para retroativos)
-- trigger_fila_processamento (AFTER INSERT - marca para processamento avançado)

-- 3. Verificar triggers ativos
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing,
  action_order
FROM information_schema.triggers 
WHERE event_object_table = 'volumetria_mobilemed' 
  AND trigger_schema = 'public'
ORDER BY action_timing, action_order, trigger_name;