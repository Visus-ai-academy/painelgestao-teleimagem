-- Verificar quais triggers realmente aplicam as regras principais
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.action_timing,
  p.proname as function_name
FROM information_schema.triggers t
JOIN pg_proc p ON p.oid = (
  SELECT oid FROM pg_proc 
  WHERE proname = replace(replace(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
  LIMIT 1
)
WHERE t.event_object_table = 'volumetria_mobilemed'
  AND t.trigger_name IN (
    'trigger_aplicar_regras_v002_v003',
    'trigger_aplicar_regra_v031', 
    'trigger_normalizar_medico',
    'trigger_aplicar_tipificacao'
  )
ORDER BY t.trigger_name;