-- Dropar função existente primeiro
DROP FUNCTION IF EXISTS limpar_dados_ficticios();

-- Recriar função corrigida sem referências a especialidade_id
CREATE OR REPLACE FUNCTION limpar_dados_ficticios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resultado jsonb;
  clientes_removidos INTEGER := 0;
  contratos_removidos INTEGER := 0;
  precos_removidos INTEGER := 0;
  exames_removidos INTEGER := 0;
  medicos_removidos INTEGER := 0;
  escalas_removidas INTEGER := 0;
  faturamento_removido INTEGER := 0;
  cadastro_exames_removidos INTEGER := 0;
  especialidades_removidas INTEGER := 0;
  categorias_removidas INTEGER := 0;
BEGIN
  -- 1. Limpar médicos fictícios (sem controle de upload válido)
  DELETE FROM medicos 
  WHERE controle_origem_id IS NULL 
    OR created_by IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM controle_uploads cu 
      WHERE cu.id = medicos.controle_origem_id 
        AND cu.status = 'concluido'
    );
  GET DIAGNOSTICS medicos_removidos = ROW_COUNT;

  -- 2. Limpar escalas órfãs (sem médico válido)
  DELETE FROM escalas_medicas 
  WHERE medico_id NOT IN (SELECT id FROM medicos);
  GET DIAGNOSTICS escalas_removidas = ROW_COUNT;

  -- 3. Limpar clientes fictícios
  DELETE FROM clientes 
  WHERE controle_origem_id IS NULL 
    OR NOT EXISTS (
      SELECT 1 FROM controle_uploads cu 
      WHERE cu.id = clientes.controle_origem_id 
        AND cu.status = 'concluido'
    );
  GET DIAGNOSTICS clientes_removidos = ROW_COUNT;

  -- 4. Limpar contratos órfãos
  DELETE FROM contratos_clientes 
  WHERE cliente_id NOT IN (SELECT id FROM clientes);
  GET DIAGNOSTICS contratos_removidos = ROW_COUNT;

  -- 5. Limpar preços órfãos
  DELETE FROM precos_servicos 
  WHERE cliente_id NOT IN (SELECT id FROM clientes);
  GET DIAGNOSTICS precos_removidos = ROW_COUNT;

  -- 6. Limpar cadastro de exames fictícios
  DELETE FROM cadastro_exames 
  WHERE controle_origem_id IS NULL 
    OR NOT EXISTS (
      SELECT 1 FROM controle_uploads cu 
      WHERE cu.id = cadastro_exames.controle_origem_id 
        AND cu.status = 'concluido'
    );
  GET DIAGNOSTICS cadastro_exames_removidos = ROW_COUNT;

  -- 7. Limpar especialidades órfãs (se tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'especialidades') THEN
    DELETE FROM especialidades 
    WHERE controle_origem_id IS NULL;
    GET DIAGNOSTICS especialidades_removidas = ROW_COUNT;
  END IF;

  -- 8. Limpar categorias órfãs (se tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias_exame') THEN
    DELETE FROM categorias_exame 
    WHERE controle_origem_id IS NULL;
    GET DIAGNOSTICS categorias_removidas = ROW_COUNT;
  END IF;

  -- Construir resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'clientes_removidos', clientes_removidos,
    'contratos_removidos', contratos_removidos,
    'precos_removidos', precos_removidos,
    'exames_removidos', exames_removidos,
    'medicos_removidos', medicos_removidos,
    'escalas_removidas', escalas_removidas,
    'faturamento_removido', faturamento_removido,
    'cadastro_exames_removidos', cadastro_exames_removidos,
    'especialidades_removidas', especialidades_removidas,
    'categorias_removidas', categorias_removidas,
    'total_removido', clientes_removidos + contratos_removidos + precos_removidos + 
                      exames_removidos + medicos_removidos + escalas_removidas + 
                      faturamento_removido + cadastro_exames_removidos + 
                      especialidades_removidas + categorias_removidas,
    'data_limpeza', now(),
    'observacao', 'Limpeza completa de dados fictícios realizada'
  );

  -- Log do resultado
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('sistema', 'LIMPEZA_FICTICIOS', 'resultado', resultado,
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  RETURN resultado;
END;
$$;