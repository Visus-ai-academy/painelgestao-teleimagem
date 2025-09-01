-- DESABILITAR TRIGGERS CONFLITANTES que estão causando exclusões incorretas

-- 1. Desabilitar trigger que aplica regras completas (conflita com sistema edge functions)
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_aplicar_regras_completas;

-- 2. Desabilitar trigger de regras básicas (duplica funcionalidades)
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_regras_basicas;

-- 3. Desabilitar trigger de quebra automática (causa exclusões incorretas)
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_quebra_automatica;

-- 4. Desabilitar trigger de fila avançada (adiciona processamento desnecessário)
ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_fila_avancado;

-- Verificar quais triggers permaneceram ativos
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  tgenabled as status
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
WHERE event_object_table = 'volumetria_mobilemed'
  AND tgenabled = 'O' -- Apenas os ativos
ORDER BY action_timing, trigger_name;