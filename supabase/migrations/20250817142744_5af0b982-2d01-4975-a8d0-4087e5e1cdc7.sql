-- Corrigir função removendo campo inexistente
CREATE OR REPLACE FUNCTION aplicar_regras_quebra_exames(arquivo_fonte_param text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_processados INTEGER := 0;
  total_quebrados INTEGER := 0;
  registro RECORD;
  regra RECORD;
  novo_id UUID;
  valor_quebrado NUMERIC;
  total_regras INTEGER;
BEGIN
  -- Contar total de regras para cada exame original
  FOR registro IN 
    SELECT vm.*, COUNT(rqe.id) as num_regras_quebra
    FROM volumetria_mobilemed vm
    INNER JOIN regras_quebra_exames rqe ON rqe.exame_original = vm."ESTUDO_DESCRICAO" AND rqe.ativo = true
    WHERE (arquivo_fonte_param IS NULL OR vm.arquivo_fonte = arquivo_fonte_param)
    GROUP BY vm.id, vm."EMPRESA", vm."NOME_PACIENTE", vm."CODIGO_PACIENTE", 
             vm."ESTUDO_DESCRICAO", vm."ACCESSION_NUMBER", vm."MODALIDADE", 
             vm."PRIORIDADE", vm."VALORES", vm."ESPECIALIDADE", vm."MEDICO",
             vm."DUPLICADO", vm."DATA_REALIZACAO", vm."HORA_REALIZACAO",
             vm."DATA_TRANSFERENCIA", vm."HORA_TRANSFERENCIA", vm."DATA_LAUDO",
             vm."HORA_LAUDO", vm."DATA_PRAZO", vm."HORA_PRAZO", vm."STATUS",
             vm."DATA_REASSINATURA", vm."HORA_REASSINATURA", vm."MEDICO_REASSINATURA",
             vm."SEGUNDA_ASSINATURA", vm."POSSUI_IMAGENS_CHAVE", vm."IMAGENS_CHAVES",
             vm."IMAGENS_CAPTURADAS", vm."CODIGO_INTERNO", vm."DIGITADOR",
             vm."COMPLEMENTAR", vm.data_referencia, vm.arquivo_fonte,
             vm.lote_upload, vm.periodo_referencia, vm."CATEGORIA", vm.created_at,
             vm.updated_at, vm.tipo_faturamento
  LOOP
    total_regras := registro.num_regras_quebra;
    
    -- Para cada regra de quebra deste exame
    FOR regra IN 
      SELECT * FROM regras_quebra_exames 
      WHERE exame_original = registro."ESTUDO_DESCRICAO" AND ativo = true
    LOOP
      -- Dividir valor pelo número de regras
      valor_quebrado := ROUND((registro."VALORES" / total_regras)::numeric, 2);
      
      -- Criar novo registro com exame quebrado
      novo_id := gen_random_uuid();
      
      INSERT INTO volumetria_mobilemed (
        id, "EMPRESA", "NOME_PACIENTE", "CODIGO_PACIENTE", "ESTUDO_DESCRICAO",
        "ACCESSION_NUMBER", "MODALIDADE", "PRIORIDADE", "VALORES", "ESPECIALIDADE",
        "MEDICO", "DUPLICADO", "DATA_REALIZACAO", "HORA_REALIZACAO",
        "DATA_TRANSFERENCIA", "HORA_TRANSFERENCIA", "DATA_LAUDO", "HORA_LAUDO",
        "DATA_PRAZO", "HORA_PRAZO", "STATUS", "DATA_REASSINATURA",
        "HORA_REASSINATURA", "MEDICO_REASSINATURA", "SEGUNDA_ASSINATURA",
        "POSSUI_IMAGENS_CHAVE", "IMAGENS_CHAVES", "IMAGENS_CAPTURADAS",
        "CODIGO_INTERNO", "DIGITADOR", "COMPLEMENTAR", data_referencia,
        arquivo_fonte, lote_upload, periodo_referencia, "CATEGORIA",
        created_at, updated_at, tipo_faturamento
      ) VALUES (
        novo_id, registro."EMPRESA", registro."NOME_PACIENTE", registro."CODIGO_PACIENTE",
        regra.exame_quebrado, registro."ACCESSION_NUMBER", registro."MODALIDADE",
        registro."PRIORIDADE", valor_quebrado, registro."ESPECIALIDADE",
        registro."MEDICO", registro."DUPLICADO", registro."DATA_REALIZACAO",
        registro."HORA_REALIZACAO", registro."DATA_TRANSFERENCIA", registro."HORA_TRANSFERENCIA",
        registro."DATA_LAUDO", registro."HORA_LAUDO", registro."DATA_PRAZO",
        registro."HORA_PRAZO", registro."STATUS", registro."DATA_REASSINATURA",
        registro."HORA_REASSINATURA", registro."MEDICO_REASSINATURA", registro."SEGUNDA_ASSINATURA",
        registro."POSSUI_IMAGENS_CHAVE", registro."IMAGENS_CHAVES", registro."IMAGENS_CAPTURADAS",
        registro."CODIGO_INTERNO", registro."DIGITADOR", registro."COMPLEMENTAR",
        registro.data_referencia, registro.arquivo_fonte, registro.lote_upload,
        registro.periodo_referencia,
        COALESCE(regra.categoria_quebrada, registro."CATEGORIA"),
        registro.created_at, now(), registro.tipo_faturamento
      );
      
      total_quebrados := total_quebrados + 1;
    END LOOP;
    
    -- Deletar registro original
    DELETE FROM volumetria_mobilemed WHERE id = registro.id;
    total_processados := total_processados + 1;
  END LOOP;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'QUEBRA_EXAMES_APLICADA', 
          COALESCE(arquivo_fonte_param, 'TODOS'),
          jsonb_build_object(
            'total_processados', total_processados,
            'total_quebrados', total_quebrados,
            'arquivo_fonte', COALESCE(arquivo_fonte_param, 'TODOS')
          ),
          'system', 'info');
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'total_processados', total_processados,
    'total_quebrados', total_quebrados,
    'arquivo_fonte', COALESCE(arquivo_fonte_param, 'TODOS')
  );
END;
$$;

-- Executar a função para aplicar quebras aos dados existentes
SELECT aplicar_regras_quebra_exames('volumetria_padrao');