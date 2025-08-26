-- Atualizar função truncate_volumetria_table para ser mais robusta
CREATE OR REPLACE FUNCTION public.truncate_volumetria_table()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- TRUNCATE é muito mais eficiente que DELETE para limpar toda a tabela
  -- Não gera WAL logs individuais e é uma operação de metadados
  TRUNCATE TABLE volumetria_mobilemed RESTART IDENTITY CASCADE;
  
  -- Log da operação (protegido contra erro se tabela audit_logs não existir)
  BEGIN
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'TRUNCATE_TABLE', 'bulk_operation', 
            jsonb_build_object('timestamp', now(), 'operacao', 'truncate_completo'),
            'system', 'warning');
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro se tabela audit_logs não existir ou tiver problema
    RAISE NOTICE 'Não foi possível registrar log de auditoria: %', SQLERRM;
  END;
END;
$$;