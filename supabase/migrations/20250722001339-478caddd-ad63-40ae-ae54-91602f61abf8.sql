-- Criar função trigger para sincronizar mapeamentos automaticamente
CREATE OR REPLACE FUNCTION public.sync_field_mappings()
RETURNS TRIGGER AS $$
DECLARE
  affected_file_type TEXT;
BEGIN
  -- Determinar o file_type afetado
  IF TG_OP = 'DELETE' THEN
    affected_file_type := OLD.file_type;
  ELSE
    affected_file_type := NEW.file_type;
  END IF;

  -- Chamar edge function de sincronização de forma assíncrona
  PERFORM net.http_post(
    url := 'https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/sincronizar-mapeamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}'::jsonb,
    body := ('{"file_type": "' || affected_file_type || '"}')::jsonb
  );

  -- Log da ação
  INSERT INTO public.audit_logs (
    table_name, operation, record_id, 
    old_data, new_data, user_id, user_email, severity
  ) VALUES (
    'field_mappings', TG_OP, COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    'info'
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na tabela field_mappings
DROP TRIGGER IF EXISTS trigger_sync_field_mappings ON public.field_mappings;
CREATE TRIGGER trigger_sync_field_mappings
  AFTER INSERT OR UPDATE OR DELETE ON public.field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_field_mappings();

-- Comentários
COMMENT ON FUNCTION public.sync_field_mappings() IS 'Função trigger que sincroniza automaticamente as edge functions quando mapeamentos são alterados';
COMMENT ON TRIGGER trigger_sync_field_mappings ON public.field_mappings IS 'Trigger que chama sincronização automática de mapeamentos';