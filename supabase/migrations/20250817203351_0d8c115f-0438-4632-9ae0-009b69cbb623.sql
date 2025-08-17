-- Criar função trigger simplificada para quebra automática
CREATE OR REPLACE FUNCTION trigger_quebra_automatica()
RETURNS TRIGGER AS $$
DECLARE
  regras_quebra RECORD;
  registro_quebrado volumetria_mobilemed%ROWTYPE;
  total_quebras INTEGER;
BEGIN
  -- Verificar se existe regra de quebra para este exame
  SELECT COUNT(*) INTO total_quebras
  FROM regras_quebra_exames 
  WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
    AND ativo = true;
  
  -- Se não há regras, retornar o registro normal
  IF total_quebras = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Se há regras, criar registros quebrados e não inserir o original
  FOR regras_quebra IN 
    SELECT exame_quebrado, categoria_quebrada 
    FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
      AND ativo = true
  LOOP
    -- Copiar dados do registro original
    registro_quebrado := NEW;
    registro_quebrado.id := gen_random_uuid();
    registro_quebrado."ESTUDO_DESCRICAO" := regras_quebra.exame_quebrado;
    registro_quebrado."VALORES" := 1; -- Valor fixo de 1 para cada quebra
    registro_quebrado."CATEGORIA" := COALESCE(regras_quebra.categoria_quebrada, NEW."CATEGORIA", 'SC');
    
    -- Inserir registro quebrado (sem disparar o trigger novamente)
    INSERT INTO volumetria_mobilemed 
    (id, "EMPRESA", "NOME_PACIENTE", "CODIGO_PACIENTE", "ESTUDO_DESCRICAO", 
     "ACCESSION_NUMBER", "MODALIDADE", "PRIORIDADE", "VALORES", "ESPECIALIDADE", 
     "MEDICO", "DUPLICADO", "DATA_REALIZACAO", "HORA_REALIZACAO", 
     "DATA_TRANSFERENCIA", "HORA_TRANSFERENCIA", "DATA_LAUDO", "HORA_LAUDO", 
     "DATA_PRAZO", "HORA_PRAZO", "STATUS", "DATA_REASSINATURA", 
     "HORA_REASSINATURA", "MEDICO_REASSINATURA", "SEGUNDA_ASSINATURA", 
     "POSSUI_IMAGENS_CHAVE", "IMAGENS_CHAVES", "IMAGENS_CAPTURADAS", 
     "CODIGO_INTERNO", "DIGITADOR", "COMPLEMENTAR", data_referencia, 
     arquivo_fonte, lote_upload, periodo_referencia, "CATEGORIA", 
     tipo_faturamento, processamento_pendente)
    VALUES 
    (registro_quebrado.id, registro_quebrado."EMPRESA", registro_quebrado."NOME_PACIENTE", 
     registro_quebrado."CODIGO_PACIENTE", registro_quebrado."ESTUDO_DESCRICAO", 
     registro_quebrado."ACCESSION_NUMBER", registro_quebrado."MODALIDADE", 
     registro_quebrado."PRIORIDADE", registro_quebrado."VALORES", registro_quebrado."ESPECIALIDADE", 
     registro_quebrado."MEDICO", registro_quebrado."DUPLICADO", registro_quebrado."DATA_REALIZACAO", 
     registro_quebrado."HORA_REALIZACAO", registro_quebrado."DATA_TRANSFERENCIA", 
     registro_quebrado."HORA_TRANSFERENCIA", registro_quebrado."DATA_LAUDO", 
     registro_quebrado."HORA_LAUDO", registro_quebrado."DATA_PRAZO", 
     registro_quebrado."HORA_PRAZO", registro_quebrado."STATUS", 
     registro_quebrado."DATA_REASSINATURA", registro_quebrado."HORA_REASSINATURA", 
     registro_quebrado."MEDICO_REASSINATURA", registro_quebrado."SEGUNDA_ASSINATURA", 
     registro_quebrado."POSSUI_IMAGENS_CHAVE", registro_quebrado."IMAGENS_CHAVES", 
     registro_quebrado."IMAGENS_CAPTURADAS", registro_quebrado."CODIGO_INTERNO", 
     registro_quebrado."DIGITADOR", registro_quebrado."COMPLEMENTAR", 
     registro_quebrado.data_referencia, registro_quebrado.arquivo_fonte, 
     registro_quebrado.lote_upload, registro_quebrado.periodo_referencia, 
     registro_quebrado."CATEGORIA", registro_quebrado.tipo_faturamento, false);
  END LOOP;
  
  -- Log da quebra
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'QUEBRA_AUTOMATICA', NEW.id::text, 
          jsonb_build_object('exame_original', NEW."ESTUDO_DESCRICAO", 'total_quebras', total_quebras),
          'system', 'info');
  
  -- NÃO inserir o registro original (retornar NULL)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para quebra automática (BEFORE INSERT)
DROP TRIGGER IF EXISTS trigger_quebra_automatica_before_insert ON volumetria_mobilemed;
CREATE TRIGGER trigger_quebra_automatica_before_insert
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_quebra_automatica();