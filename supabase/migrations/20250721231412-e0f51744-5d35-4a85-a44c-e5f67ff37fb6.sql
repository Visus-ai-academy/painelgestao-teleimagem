-- Corrigir função audit_trigger para usar parâmetros corretos
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'DELETE'::text, OLD.id::text, row_to_json(OLD)::jsonb, NULL::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'UPDATE'::text, NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'INSERT'::text, NEW.id::text, NULL::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$