-- Criar função para aplicar regras v002, v003, v031 automaticamente
CREATE OR REPLACE FUNCTION public.aplicar_regras_periodo_automatico()
RETURNS TRIGGER AS $$
DECLARE
  periodo_ref TEXT;
  ano_ref INTEGER;
  mes_ref INTEGER;
  meses_map JSONB = '{"janeiro":1,"jan":1,"fevereiro":2,"fev":2,"março":3,"mar":3,"abril":4,"abr":4,"maio":5,"mai":5,"junho":6,"jun":6,"julho":7,"jul":7,"agosto":8,"ago":8,"setembro":9,"set":9,"outubro":10,"out":10,"novembro":11,"nov":11,"dezembro":12,"dez":12}';
  data_limite_realizacao DATE;
  data_inicio_faturamento DATE;
  data_fim_faturamento DATE;
  data_inicio_mes DATE;
  data_fim_mes DATE;
  data_limite_laudo DATE;
  motivo_exclusao TEXT;
BEGIN
  -- Obter período de referência do registro
  periodo_ref := NEW.periodo_referencia;
  
  IF periodo_ref IS NULL OR periodo_ref = '' THEN
    -- Sem período definido, permitir inserção
    RETURN NEW;
  END IF;
  
  -- Extrair mês e ano do período
  BEGIN
    WITH periodo_split AS (
      SELECT 
        split_part(lower(periodo_ref), '/', 1) as mes_str,
        split_part(lower(periodo_ref), '/', 2) as ano_str
    )
    SELECT 
      (meses_map->>mes_str)::INTEGER,
      CASE 
        WHEN length(ano_str) = 2 THEN 2000 + ano_str::INTEGER
        ELSE ano_str::INTEGER
      END
    INTO mes_ref, ano_ref
    FROM periodo_split;
    
    IF mes_ref IS NULL OR ano_ref IS NULL THEN
      -- Formato inválido, permitir inserção
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Erro no parse, permitir inserção
    RETURN NEW;
  END;
  
  -- Calcular datas de referência
  data_inicio_mes := DATE_TRUNC('month', make_date(ano_ref, mes_ref, 1));
  data_fim_mes := (data_inicio_mes + INTERVAL '1 month - 1 day')::DATE;
  data_inicio_faturamento := make_date(ano_ref, mes_ref, 8);
  data_fim_faturamento := make_date(ano_ref, mes_ref + 1, 7);
  data_limite_laudo := make_date(ano_ref, mes_ref, 7);
  
  -- REGRA v002/v003: Arquivos retroativos - exclusão por DATA_REALIZACAO e DATA_LAUDO
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    -- v002: Excluir se DATA_REALIZACAO >= primeiro dia do mês de referência
    IF NEW."DATA_REALIZACAO" IS NOT NULL AND NEW."DATA_REALIZACAO" >= data_inicio_mes THEN
      motivo_exclusao := 'v002_REALIZACAO_PERIODO_ATUAL';
      INSERT INTO registros_rejeitados_processamento (
        arquivo_fonte, lote_upload, linha_original, dados_originais, 
        motivo_rejeicao, detalhes_erro, created_at
      ) VALUES (
        COALESCE(NEW.arquivo_fonte, 'unknown'), COALESCE(NEW.lote_upload, 'unknown'), 
        1, row_to_json(NEW), motivo_exclusao,
        format('DATA_REALIZACAO %s >= %s (início do período %s)', 
               NEW."DATA_REALIZACAO", data_inicio_mes, periodo_ref),
        now()
      );
      RETURN NULL;
    END IF;
    
    -- v003: Excluir se DATA_LAUDO fora da janela de faturamento (8 do mês até 7 do mês seguinte)
    IF NEW."DATA_LAUDO" IS NOT NULL AND 
       (NEW."DATA_LAUDO" < data_inicio_faturamento OR NEW."DATA_LAUDO" > data_fim_faturamento) THEN
      motivo_exclusao := 'v003_LAUDO_FORA_JANELA_FATURAMENTO';
      INSERT INTO registros_rejeitados_processamento (
        arquivo_fonte, lote_upload, linha_original, dados_originais, 
        motivo_rejeicao, detalhes_erro, created_at
      ) VALUES (
        COALESCE(NEW.arquivo_fonte, 'unknown'), COALESCE(NEW.lote_upload, 'unknown'), 
        1, row_to_json(NEW), motivo_exclusao,
        format('DATA_LAUDO %s fora da janela %s a %s (período %s)', 
               NEW."DATA_LAUDO", data_inicio_faturamento, data_fim_faturamento, periodo_ref),
        now()
      );
      RETURN NULL;
    END IF;
  END IF;
  
  -- REGRA v031: Arquivos não-retroativos - exclusão por DATA_LAUDO
  IF NEW.arquivo_fonte NOT LIKE '%retroativo%' AND NEW.arquivo_fonte NOT LIKE '%onco%' THEN
    -- v031: Excluir se DATA_LAUDO > dia 7 do mês de referência
    IF NEW."DATA_LAUDO" IS NOT NULL AND NEW."DATA_LAUDO" > data_limite_laudo THEN
      motivo_exclusao := 'v031_LAUDO_APOS_LIMITE';
      INSERT INTO registros_rejeitados_processamento (
        arquivo_fonte, lote_upload, linha_original, dados_originais, 
        motivo_rejeicao, detalhes_erro, created_at
      ) VALUES (
        COALESCE(NEW.arquivo_fonte, 'unknown'), COALESCE(NEW.lote_upload, 'unknown'), 
        1, row_to_json(NEW), motivo_exclusao,
        format('DATA_LAUDO %s > %s (limite para período %s)', 
               NEW."DATA_LAUDO", data_limite_laudo, periodo_ref),
        now()
      );
      RETURN NULL;
    END IF;
  END IF;
  
  -- Se passou em todas as validações, permitir inserção
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar o trigger principal para incluir as regras de período
CREATE OR REPLACE FUNCTION public.trigger_aplicar_regras_completas()
RETURNS TRIGGER AS $$
DECLARE
  novo_valor NUMERIC;
  categoria_encontrada TEXT;
  regras_quebra RECORD;
  registro_quebrado volumetria_mobilemed%ROWTYPE;
  tem_quebra BOOLEAN := false;
BEGIN
  -- 1. PRIMEIRO: Aplicar regras de período (v002, v003, v031)
  NEW := aplicar_regras_periodo_automatico();
  IF NEW IS NULL THEN 
    -- Registro foi excluído pelas regras de período
    RETURN NULL; 
  END IF;
  
  -- 2. Normalizar nome do cliente
  IF NEW."EMPRESA" IS NOT NULL THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 3. Aplicar correção de modalidades
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
      NEW."MODALIDADE" := 'MG';
    ELSE
      NEW."MODALIDADE" := 'RX';
    END IF;
  END IF;
  
  IF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- 4. Aplicar De-Para para valores zerados
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO novo_valor
    FROM valores_referencia_de_para vr
    WHERE vr.estudo_descricao = NEW."ESTUDO_DESCRICAO"
      AND vr.ativo = true
    LIMIT 1;
    
    IF novo_valor IS NOT NULL THEN
      NEW."VALORES" := novo_valor;
    END IF;
  END IF;
  
  -- 5. Aplicar categoria do cadastro de exames
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO categoria_encontrada
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    NEW."CATEGORIA" := COALESCE(categoria_encontrada, 'SC');
  END IF;
  
  -- 6. Categoria especial para arquivo onco
  IF NEW.arquivo_fonte = 'volumetria_onco_padrao' THEN
    NEW."CATEGORIA" := 'Onco';
  END IF;
  
  -- 7. Definir tipo de faturamento
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
    NEW.tipo_faturamento := 'urgencia';
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  -- 8. Normalizar médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 9. QUEBRA AUTOMÁTICA
  FOR regras_quebra IN 
    SELECT exame_quebrado, categoria_quebrada 
    FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
      AND ativo = true
  LOOP
    tem_quebra := true;
    
    -- Copiar dados do registro original
    registro_quebrado := NEW;
    registro_quebrado.id := gen_random_uuid();
    registro_quebrado."ESTUDO_DESCRICAO" := regras_quebra.exame_quebrado;
    registro_quebrado."VALORES" := NEW."VALORES";
    
    -- Aplicar categoria da quebra se definida
    IF regras_quebra.categoria_quebrada IS NOT NULL THEN
      registro_quebrado."CATEGORIA" := regras_quebra.categoria_quebrada;
    END IF;
    
    -- Marcar processamento como completo
    registro_quebrado.processamento_pendente := false;
    
    -- Inserir registro quebrado
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
     registro_quebrado."CATEGORIA", registro_quebrado.tipo_faturamento, 
     registro_quebrado.processamento_pendente);
  END LOOP;
  
  -- Se teve quebra, NÃO inserir o registro original (retornar NULL)
  IF tem_quebra THEN
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'QUEBRA_AUTOMATICA', NEW.id::text, 
            jsonb_build_object('exame_original', NEW."ESTUDO_DESCRICAO", 'tem_quebra', true),
            'system', 'info');
    
    RETURN NULL;
  END IF;
  
  -- Se não teve quebra, garantir que processamento_pendente seja false
  NEW.processamento_pendente := false;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;