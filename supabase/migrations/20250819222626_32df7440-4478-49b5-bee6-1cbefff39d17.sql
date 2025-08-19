-- Corrigir funções de quebra que estão usando campos inexistentes
-- Função aplicar_quebras_pendentes corrigida
CREATE OR REPLACE FUNCTION public.aplicar_quebras_pendentes(arquivo_fonte_param text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_processados INTEGER := 0;
  total_quebrados INTEGER := 0;
  registro RECORD;
  regra RECORD;
  novo_id UUID;
BEGIN
  -- Processar apenas registros marcados como pendentes
  FOR registro IN 
    SELECT vm.*
    FROM volumetria_mobilemed vm
    INNER JOIN regras_quebra_exames rqe ON rqe.exame_original = vm."ESTUDO_DESCRICAO" AND rqe.ativo = true
    WHERE (arquivo_fonte_param IS NULL OR vm.arquivo_fonte = arquivo_fonte_param)
    AND vm.processamento_pendente = true
  LOOP
    -- Para cada regra de quebra deste exame
    FOR regra IN 
      SELECT * FROM regras_quebra_exames 
      WHERE exame_original = registro."ESTUDO_DESCRICAO" AND ativo = true
    LOOP
      -- Criar novo registro com exame quebrado - valor fixo de 1
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
        created_at, updated_at, tipo_faturamento, processamento_pendente
      ) VALUES (
        novo_id, registro."EMPRESA", registro."NOME_PACIENTE", registro."CODIGO_PACIENTE",
        regra.exame_quebrado, registro."ACCESSION_NUMBER", registro."MODALIDADE",
        registro."PRIORIDADE", 1, registro."ESPECIALIDADE", -- VALOR FIXO: 1
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
        registro.created_at, now(), registro.tipo_faturamento, false
      );
      
      total_quebrados := total_quebrados + 1;
    END LOOP;
    
    -- Deletar registro original
    DELETE FROM volumetria_mobilemed WHERE id = registro.id;
    total_processados := total_processados + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'total_processados', total_processados,
    'total_quebrados', total_quebrados,
    'arquivo_fonte', COALESCE(arquivo_fonte_param, 'TODOS')
  );
END;
$function$;