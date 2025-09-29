-- Corrigir função limpar_dados_ficticios removendo referência a especialidade_id
CREATE OR REPLACE FUNCTION public.limpar_dados_ficticios()
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
  modalidades_removidas INTEGER := 0;
  categorias_removidas INTEGER := 0;
BEGIN
  -- Log do início da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('sistema', 'LIMPEZA_FICTICIOS', 'inicio', 
          jsonb_build_object('timestamp', now(), 'operacao', 'limpeza_dados_ficticios'),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  -- 1. Limpar especialidades sem dados de upload (SEM usar especialidade_id)
  DELETE FROM especialidades 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'especialidades' 
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS especialidades_removidas = ROW_COUNT;

  -- 2. Limpar modalidades sem dados de upload (SEM usar modalidade_id)
  DELETE FROM modalidades 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'modalidades' 
      AND ih.status = 'completed'
  );

  -- 3. Limpar categorias sem dados de upload (SEM usar categoria_id)
  DELETE FROM categorias_exame 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'categorias' 
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS categorias_removidas = ROW_COUNT;

  -- 4. Limpar cadastro de exames fictícios (sem origem de upload)
  DELETE FROM cadastro_exames 
  WHERE created_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'cadastro_exames'
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS cadastro_exames_removidos = ROW_COUNT;

  -- 5. Limpar preços fictícios (sem vínculo com uploads)
  DELETE FROM precos_servicos 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'precos_servicos'
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS precos_removidos = ROW_COUNT;

  -- 6. Limpar contratos fictícios
  DELETE FROM contratos_clientes 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'contratos'
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS contratos_removidos = ROW_COUNT;

  -- 7. Limpar clientes fictícios (sem dados de upload)
  DELETE FROM clientes 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'clientes'
      AND ih.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM volumetria_mobilemed vm 
    WHERE vm."EMPRESA" = clientes.nome
  );
  GET DIAGNOSTICS clientes_removidos = ROW_COUNT;

  -- 8. Limpar médicos fictícios
  DELETE FROM medicos 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'medicos'
      AND ih.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM volumetria_mobilemed vm 
    WHERE vm."MEDICO" = medicos.nome
  );
  GET DIAGNOSTICS medicos_removidos = ROW_COUNT;

  -- 9. Limpar escalas fictícias
  DELETE FROM escalas_medicas 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'escalas'
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS escalas_removidas = ROW_COUNT;

  -- 10. Limpar exames fictícios
  DELETE FROM exames 
  WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM import_history ih 
    WHERE ih.file_type = 'exames'
      AND ih.status = 'completed'
  );
  GET DIAGNOSTICS exames_removidos = ROW_COUNT;

  -- 11. Limpar faturamento fictício
  DELETE FROM faturamento 
  WHERE controle_origem_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM controle_dados_origem cdo 
    WHERE cdo.id = faturamento.controle_origem_id 
      AND cdo.tipo_dados IN ('incremental', 'completo')
  );
  GET DIAGNOSTICS faturamento_removido = ROW_COUNT;

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