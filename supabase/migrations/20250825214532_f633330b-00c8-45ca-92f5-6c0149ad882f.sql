-- Criar função para TRUNCATE da tabela volumetria_mobilemed
-- TRUNCATE é muito mais rápido que DELETE para limpeza completa
CREATE OR REPLACE FUNCTION public.exec_truncate_volumetria()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- TRUNCATE é mais rápido que DELETE e reseta sequences
  -- Bypassa triggers e é otimizado para limpeza completa
  TRUNCATE TABLE volumetria_mobilemed;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'TRUNCATE_TABLE', 'bulk', 
          jsonb_build_object('operacao', 'limpeza_completa_truncate'),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
END;
$function$