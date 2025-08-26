-- Criar função para TRUNCATE da tabela volumetria_mobilemed de forma eficiente
CREATE OR REPLACE FUNCTION public.truncate_volumetria_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- TRUNCATE é muito mais eficiente que DELETE para limpar toda a tabela
  -- Não gera WAL logs individuais e é uma operação de metadados
  TRUNCATE TABLE volumetria_mobilemed RESTART IDENTITY CASCADE;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'TRUNCATE_TABLE', 'bulk_operation', 
          jsonb_build_object('timestamp', now(), 'operacao', 'truncate_completo'),
          'system', 'warning');
END;
$function$;