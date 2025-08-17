-- Criar trigger para aplicar quebra automaticamente em novos registros
CREATE OR REPLACE FUNCTION trigger_aplicar_quebra_exames()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  regras_quebra RECORD;
  total_regras INTEGER;
  valor_quebrado NUMERIC;
  novo_id UUID;
BEGIN
  -- Verificar se existe regra de quebra para este exame
  SELECT COUNT(*) INTO total_regras
  FROM regras_quebra_exames rqe
  WHERE rqe.exame_original = NEW."ESTUDO_DESCRICAO" AND rqe.ativo = true;
  
  IF total_regras > 0 THEN
    -- Para cada regra de quebra
    FOR regras_quebra IN 
      SELECT * FROM regras_quebra_exames 
      WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
    LOOP
      -- Calcular valor quebrado (dividir pelo número de regras)
      valor_quebrado := ROUND((NEW."VALORES" / total_regras)::numeric, 2);
      
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
        novo_id, NEW."EMPRESA", NEW."NOME_PACIENTE", NEW."CODIGO_PACIENTE",
        regras_quebra.exame_quebrado, NEW."ACCESSION_NUMBER", NEW."MODALIDADE",
        NEW."PRIORIDADE", valor_quebrado, NEW."ESPECIALIDADE",
        NEW."MEDICO", NEW."DUPLICADO", NEW."DATA_REALIZACAO",
        NEW."HORA_REALIZACAO", NEW."DATA_TRANSFERENCIA", NEW."HORA_TRANSFERENCIA",
        NEW."DATA_LAUDO", NEW."HORA_LAUDO", NEW."DATA_PRAZO",
        NEW."HORA_PRAZO", NEW."STATUS", NEW."DATA_REASSINATURA",
        NEW."HORA_REASSINATURA", NEW."MEDICO_REASSINATURA", NEW."SEGUNDA_ASSINATURA",
        NEW."POSSUI_IMAGENS_CHAVE", NEW."IMAGENS_CHAVES", NEW."IMAGENS_CAPTURADAS",
        NEW."CODIGO_INTERNO", NEW."DIGITADOR", NEW."COMPLEMENTAR",
        NEW.data_referencia, NEW.arquivo_fonte, NEW.lote_upload,
        NEW.periodo_referencia,
        COALESCE(regras_quebra.categoria_quebrada, NEW."CATEGORIA"),
        NEW.created_at, now(), NEW.tipo_faturamento
      );
    END LOOP;
    
    -- Não inserir o registro original (retornar NULL)
    RETURN NULL;
  END IF;
  
  -- Se não há regras, inserir normalmente
  RETURN NEW;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_quebra_exames_insert ON volumetria_mobilemed;
CREATE TRIGGER trigger_quebra_exames_insert
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_quebra_exames();