-- Verificar se a função truncate_volumetria_table existe e qual é seu conteúdo
CREATE OR REPLACE FUNCTION public.truncate_volumetria_table()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log da operação antes de executar
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'TRUNCATE_TABLE', 'all_records', 
          jsonb_build_object('action', 'truncate_volumetria_table', 'timestamp', now()),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'warning');

  -- APENAS limpar a tabela volumetria_mobilemed
  TRUNCATE TABLE volumetria_mobilemed RESTART IDENTITY CASCADE;
  
  -- Log de confirmação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'TRUNCATE_COMPLETED', 'all_records', 
          jsonb_build_object('action', 'truncate_completed', 'timestamp', now()),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
END;
$function$