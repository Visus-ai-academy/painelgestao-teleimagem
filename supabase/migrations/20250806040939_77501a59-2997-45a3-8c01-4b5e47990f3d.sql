-- Limpeza direta dos preços usando função com SECURITY DEFINER
CREATE OR REPLACE FUNCTION limpar_todos_precos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM precos_servicos;
  UPDATE contratos_clientes SET tem_precos_configurados = false;
END;
$$;

-- Executar a função de limpeza
SELECT limpar_todos_precos();

-- Verificar resultado
SELECT COUNT(*) as precos_restantes FROM precos_servicos;