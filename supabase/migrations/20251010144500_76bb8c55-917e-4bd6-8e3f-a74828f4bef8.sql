-- Tornar limpeza instantânea e evitar timeouts
CREATE OR REPLACE FUNCTION public.limpar_todos_precos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Garantir execução sem RLS e com timeout maior
  PERFORM set_config('statement_timeout', '120s', true);
  SET LOCAL row_security = off;

  -- Limpeza rápida
  TRUNCATE TABLE precos_servicos;

  -- Ajustar contratos
  UPDATE contratos_clientes 
  SET tem_precos_configurados = false 
  WHERE tem_precos_configurados = true;
END;
$function$;