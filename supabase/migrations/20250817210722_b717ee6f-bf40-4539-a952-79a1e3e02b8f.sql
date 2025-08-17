-- Criar função SQL para aplicar Regra v024 - Definição Data Referência
-- Esta função garante que data_referencia e periodo_referencia sejam definidos 
-- baseados no período de processamento escolhido, não nas datas originais dos exames

CREATE OR REPLACE FUNCTION public.aplicar_data_referencia_por_periodo(
  p_ano INTEGER,
  p_mes INTEGER,
  p_arquivo_fonte TEXT DEFAULT NULL,
  p_lote_upload TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  data_ref DATE;
  periodo_ref TEXT;
  registros_atualizados INTEGER := 0;
  mes_nomes TEXT[] := ARRAY['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  resultado jsonb;
BEGIN
  -- Validar entrada
  IF p_ano IS NULL OR p_mes IS NULL OR p_mes < 1 OR p_mes > 12 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Ano e mês válidos são obrigatórios (mês: 1-12)'
    );
  END IF;

  -- Calcular data_referencia e periodo_referencia
  data_ref := DATE(p_ano, p_mes, 1);
  periodo_ref := mes_nomes[p_mes] || '/' || RIGHT(p_ano::text, 2);

  -- Aplicar atualização com filtros opcionais
  UPDATE volumetria_mobilemed 
  SET 
    data_referencia = data_ref,
    periodo_referencia = periodo_ref,
    updated_at = now()
  WHERE 
    (p_arquivo_fonte IS NULL OR arquivo_fonte = p_arquivo_fonte)
    AND (p_lote_upload IS NULL OR lote_upload = p_lote_upload);

  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;

  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES (
    'volumetria_mobilemed', 
    'REGRA_V024_SQL', 
    COALESCE(p_arquivo_fonte, 'ALL') || '_' || COALESCE(p_lote_upload, 'ALL'),
    jsonb_build_object(
      'data_referencia', data_ref,
      'periodo_referencia', periodo_ref,
      'registros_atualizados', registros_atualizados,
      'ano', p_ano,
      'mes', p_mes,
      'arquivo_fonte', p_arquivo_fonte,
      'lote_upload', p_lote_upload
    ),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    'info'
  );

  resultado := jsonb_build_object(
    'sucesso', true,
    'data_referencia', data_ref,
    'periodo_referencia', periodo_ref,
    'registros_atualizados', registros_atualizados,
    'mensagem', 'Regra v024 aplicada: ' || registros_atualizados || ' registros atualizados com período ' || periodo_ref
  );

  RETURN resultado;
END;
$function$;

-- Trigger para aplicar automaticamente a regra v024 em novos registros
CREATE OR REPLACE FUNCTION public.trigger_aplicar_data_referencia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  mes_nomes TEXT[] := ARRAY['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  ano_ref INTEGER;
  mes_ref INTEGER;
BEGIN
  -- Se data_referencia não está definida ou é nula, tentar extrair do periodo_referencia
  IF NEW.data_referencia IS NULL AND NEW.periodo_referencia IS NOT NULL THEN
    -- Extrair ano e mês do periodo_referencia (formato: 'jun/25')
    BEGIN
      ano_ref := 2000 + RIGHT(SPLIT_PART(NEW.periodo_referencia, '/', 2), 2)::INTEGER;
      
      FOR i IN 1..12 LOOP
        IF mes_nomes[i] = SPLIT_PART(NEW.periodo_referencia, '/', 1) THEN
          mes_ref := i;
          EXIT;
        END IF;
      END LOOP;
      
      IF ano_ref IS NOT NULL AND mes_ref IS NOT NULL THEN
        NEW.data_referencia := DATE(ano_ref, mes_ref, 1);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Se houver erro na conversão, manter valor original
      NULL;
    END;
  END IF;

  -- Se periodo_referencia não está definido mas data_referencia está, gerar periodo_referencia
  IF NEW.periodo_referencia IS NULL AND NEW.data_referencia IS NOT NULL THEN
    ano_ref := EXTRACT(YEAR FROM NEW.data_referencia::date);
    mes_ref := EXTRACT(MONTH FROM NEW.data_referencia::date);
    NEW.periodo_referencia := mes_nomes[mes_ref] || '/' || RIGHT(ano_ref::text, 2);
  END IF;

  RETURN NEW;
END;
$function$;

-- Aplicar trigger na tabela volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_data_referencia ON volumetria_mobilemed;
CREATE TRIGGER trigger_data_referencia
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_data_referencia();