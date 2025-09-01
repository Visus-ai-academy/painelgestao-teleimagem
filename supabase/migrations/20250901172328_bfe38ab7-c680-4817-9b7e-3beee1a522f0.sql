-- Corrigir aplicação das regras v002/v003/v031 conforme especificação
-- v002/v003: APENAS arquivos retroativos
-- v031: APENAS arquivos normais (1 e 2)

-- 1. Modificar trigger v002/v003 para ser mais específico para retroativos
CREATE OR REPLACE FUNCTION aplicar_regras_v002_v003_trigger()
RETURNS TRIGGER AS $$
DECLARE
  data_limite_realizacao DATE;
  data_inicio_janela_laudo DATE;
  data_fim_janela_laudo DATE;
BEGIN
  -- APLICAR APENAS para arquivos retroativos (contém 'retroativo' no nome)
  IF NEW.arquivo_fonte NOT LIKE '%retroativo%' THEN
    RETURN NEW; -- Permitir inserção para arquivos não-retroativos
  END IF;
  
  -- Regra v003: DATA_REALIZACAO deve ser < 01/06/2025
  data_limite_realizacao := '2025-06-01'::date;
  
  -- Regra v002: DATA_LAUDO deve estar entre 08/06/2025 e 07/07/2025
  data_inicio_janela_laudo := '2025-06-08'::date;
  data_fim_janela_laudo := '2025-07-07'::date;
  
  -- APLICAR REGRA V003: Rejeitar se DATA_REALIZACAO >= data_limite_realizacao
  IF NEW."DATA_REALIZACAO" >= data_limite_realizacao THEN
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      NEW.arquivo_fonte, NEW.lote_upload, 1, row_to_json(NEW),
      'REGRA_V003_TRIGGER',
      format('DATA_REALIZACAO %s >= %s (limite v003 - APENAS RETROATIVOS)', NEW."DATA_REALIZACAO", data_limite_realizacao),
      now()
    );
    RETURN NULL;
  END IF;
  
  -- APLICAR REGRA V002: Rejeitar se DATA_LAUDO fora da janela permitida
  IF NEW."DATA_LAUDO" < data_inicio_janela_laudo OR NEW."DATA_LAUDO" > data_fim_janela_laudo THEN
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais,
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      NEW.arquivo_fonte, NEW.lote_upload, 1, row_to_json(NEW),
      'REGRA_V002_TRIGGER', 
      format('DATA_LAUDO %s fora da janela %s - %s (regra v002 - APENAS RETROATIVOS)', NEW."DATA_LAUDO", data_inicio_janela_laudo, data_fim_janela_laudo),
      now()
    );
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Criar função para regra v031 (aplicar APENAS aos arquivos normais)
CREATE OR REPLACE FUNCTION aplicar_regra_v031_trigger()
RETURNS TRIGGER AS $$
DECLARE
  data_limite_periodo DATE;
BEGIN
  -- APLICAR APENAS para arquivos NÃO retroativos (arquivos 1 e 2)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    RETURN NEW; -- Não aplicar v031 para retroativos
  END IF;
  
  -- Regra v031: DATA_REALIZACAO deve estar no período correto (jun/25)
  -- Permitir apenas dados de junho/2025 (01/06/2025 até 30/06/2025)
  IF NEW."DATA_REALIZACAO" < '2025-06-01'::date OR NEW."DATA_REALIZACAO" > '2025-06-30'::date THEN
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais,
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      NEW.arquivo_fonte, NEW.lote_upload, 1, row_to_json(NEW),
      'REGRA_V031_TRIGGER',
      format('DATA_REALIZACAO %s fora do período jun/25 (regra v031 - APENAS ARQUIVOS NORMAIS)', NEW."DATA_REALIZACAO"),
      now()
    );
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recriar triggers com condições específicas
DROP TRIGGER IF EXISTS trigger_aplicar_v002_v003 ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_v002_v003
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  WHEN (NEW.arquivo_fonte LIKE '%retroativo%')
  EXECUTE FUNCTION aplicar_regras_v002_v003_trigger();

DROP TRIGGER IF EXISTS trigger_aplicar_v031 ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_v031
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  WHEN (NEW.arquivo_fonte NOT LIKE '%retroativo%')
  EXECUTE FUNCTION aplicar_regra_v031_trigger();