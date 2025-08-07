-- Corrigir função limpar_todos_precos para usar WHERE clause segura
CREATE OR REPLACE FUNCTION public.limpar_todos_precos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- DELETE com WHERE clause segura (todos os registros)
  DELETE FROM precos_servicos WHERE id IS NOT NULL;
  
  -- Atualizar contratos para indicar que não têm preços configurados
  UPDATE contratos_clientes SET tem_precos_configurados = false WHERE id IS NOT NULL;
END;
$function$