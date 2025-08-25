-- Corrigir a regra v003 para usar data dinâmica ao invés de data fixa
CREATE OR REPLACE FUNCTION public.aplicar_regras_periodo_automatico(record volumetria_mobilemed) 
RETURNS volumetria_mobilemed
LANGUAGE plpgsql
AS $$
DECLARE
  periodo_ref TEXT;
  ano INTEGER;
  mes INTEGER;
  data_inicio_realizacao DATE;
  data_fim_realizacao DATE;
  data_inicio_laudo DATE;
  data_fim_laudo DATE;
  mes_map JSONB := '{"jan":1,"janeiro":1,"fev":2,"fevereiro":2,"mar":3,"março":3,"abr":4,"abril":4,"mai":5,"maio":5,"jun":6,"junho":6,"jul":7,"julho":7,"ago":8,"agosto":8,"set":9,"setembro":9,"out":10,"outubro":10,"nov":11,"novembro":11,"dez":12,"dezembro":12}';
BEGIN
  -- Se não tem período de referência, não aplicar regras
  IF record.periodo_referencia IS NULL OR record.periodo_referencia = '' THEN
    RETURN record;
  END IF;
  
  periodo_ref := lower(record.periodo_referencia);
  
  -- Extrair mês e ano
  IF periodo_ref ~ '^[a-z]+/\d+$' THEN
    mes := (mes_map->>split_part(periodo_ref, '/', 1))::INTEGER;
    ano := CASE 
      WHEN length(split_part(periodo_ref, '/', 2)) = 2 
      THEN 2000 + split_part(periodo_ref, '/', 2)::INTEGER
      ELSE split_part(periodo_ref, '/', 2)::INTEGER
    END;
  ELSE
    -- Se formato inválido, rejeitar
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro
    ) VALUES (
      record.arquivo_fonte, record.lote_upload, 1, row_to_json(record),
      'PERIODO_REFERENCIA_INVALIDO', 
      'Formato de período inválido: ' || record.periodo_referencia
    );
    RETURN NULL;
  END IF;
  
  -- Calcular períodos válidos
  -- REGRA v002: DATA_REALIZACAO deve estar no mês de referência
  data_inicio_realizacao := make_date(ano, mes, 1);
  data_fim_realizacao := (make_date(ano, mes, 1) + interval '1 month - 1 day')::DATE;
  
  -- REGRA v031: DATA_LAUDO deve estar entre dia 8 do mês até dia 7 do mês seguinte
  data_inicio_laudo := make_date(ano, mes, 8);
  data_fim_laudo := make_date(ano, mes + 1, 7);
  
  -- REGRA v003: DATA_REALIZACAO não pode ser futura (posterior à data atual)
  IF record."DATA_REALIZACAO" > CURRENT_DATE THEN
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro
    ) VALUES (
      record.arquivo_fonte, record.lote_upload, 1, row_to_json(record),
      'REGRA_v003_DATA_FUTURA', 
      'DATA_REALIZACAO futura: ' || record."DATA_REALIZACAO"::TEXT || ' > data atual: ' || CURRENT_DATE::TEXT
    );
    RETURN NULL;
  END IF;
  
  -- APLICAR REGRAS APENAS PARA ARQUIVOS NÃO-RETROATIVOS
  IF record.arquivo_fonte NOT LIKE '%retroativo%' THEN
    
    -- REGRA v002: Verificar DATA_REALIZACAO no período do mês
    IF record."DATA_REALIZACAO" < data_inicio_realizacao OR record."DATA_REALIZACAO" > data_fim_realizacao THEN
      INSERT INTO registros_rejeitados_processamento (
        arquivo_fonte, lote_upload, linha_original, dados_originais, 
        motivo_rejeicao, detalhes_erro
      ) VALUES (
        record.arquivo_fonte, record.lote_upload, 1, row_to_json(record),
        'REGRA_v002_PERIODO_REALIZACAO', 
        'DATA_REALIZACAO ' || record."DATA_REALIZACAO"::TEXT || ' fora do período válido (' || 
        data_inicio_realizacao::TEXT || ' até ' || data_fim_realizacao::TEXT || ')'
      );
      RETURN NULL;
    END IF;
    
    -- REGRA v031: Verificar DATA_LAUDO no período válido (dia 8 do mês até dia 7 do mês seguinte)
    IF record."DATA_LAUDO" IS NOT NULL AND 
       (record."DATA_LAUDO" < data_inicio_laudo OR record."DATA_LAUDO" > data_fim_laudo) THEN
      INSERT INTO registros_rejeitados_processamento (
        arquivo_fonte, lote_upload, linha_original, dados_originais, 
        motivo_rejeicao, detalhes_erro
      ) VALUES (
        record.arquivo_fonte, record.lote_upload, 1, row_to_json(record),
        'REGRA_v031_PERIODO_LAUDO', 
        'DATA_LAUDO ' || record."DATA_LAUDO"::TEXT || ' fora do período válido (' || 
        data_inicio_laudo::TEXT || ' até ' || data_fim_laudo::TEXT || ')'
      );
      RETURN NULL;
    END IF;
  END IF;
  
  RETURN record;
END;
$$;