-- Atualiza a função para limpeza batelada, evitando timeouts
CREATE OR REPLACE FUNCTION public.limpar_todos_precos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deletados INTEGER;
  total INTEGER := 0;
BEGIN
  -- Aumentar o timeout local da transação para evitar cancelamento
  PERFORM set_config('statement_timeout', '120s', true);

  -- Remover em lotes para não estourar o statement_timeout
  LOOP
    DELETE FROM precos_servicos
    WHERE id IN (
      SELECT id FROM precos_servicos
      LIMIT 1000
    );
    GET DIAGNOSTICS deletados = ROW_COUNT;
    total := total + COALESCE(deletados, 0);

    EXIT WHEN deletados = 0; -- terminou
  END LOOP;

  -- Atualizar contratos para indicar que não têm preços configurados
  UPDATE contratos_clientes 
  SET tem_precos_configurados = false 
  WHERE tem_precos_configurados = true;

  -- opcionalmente poderíamos logar aqui, mas manter simples
END;
$function$;