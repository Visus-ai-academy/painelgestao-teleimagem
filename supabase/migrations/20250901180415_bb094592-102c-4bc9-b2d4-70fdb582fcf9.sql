-- Verificar status atual dos triggers na volumetria_mobilemed
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  tgenabled as enabled
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
WHERE event_object_table = 'volumetria_mobilemed'
ORDER BY trigger_name;