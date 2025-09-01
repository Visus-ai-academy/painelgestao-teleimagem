-- Criar trigger para aplicar regras v002/v003 automaticamente durante o upload
-- Este trigger será executado ANTES de inserir cada registro na volumetria_mobilemed

CREATE OR REPLACE FUNCTION aplicar_regras_v002_v003_trigger()
RETURNS TRIGGER AS $$
DECLARE
  data_limite_realizacao DATE;
  data_inicio_janela_laudo DATE;
  data_fim_janela_laudo DATE;
BEGIN
  -- Aplicar apenas para arquivos retroativos
  IF NEW.arquivo_fonte NOT LIKE '%retroativo%' THEN
    RETURN NEW; -- Permitir inserção para arquivos não-retroativos
  END IF;
  
  -- Definir datas baseadas no período de referência (assumindo jun/25 como padrão)
  -- Regra v003: DATA_REALIZACAO deve ser < 01/06/2025
  data_limite_realizacao := '2025-06-01'::date;
  
  -- Regra v002: DATA_LAUDO deve estar entre 08/06/2025 e 07/07/2025
  data_inicio_janela_laudo := '2025-06-08'::date;
  data_fim_janela_laudo := '2025-07-07'::date;
  
  -- APLICAR REGRA V003: Rejeitar se DATA_REALIZACAO >= data_limite_realizacao
  IF NEW."DATA_REALIZACAO" >= data_limite_realizacao THEN
    -- Log da exclusão para auditoria
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      NEW.arquivo_fonte, 
      NEW.lote_upload, 
      1, 
      row_to_json(NEW),
      'REGRA_V003_TRIGGER',
      format('DATA_REALIZACAO %s >= %s (limite v003)', NEW."DATA_REALIZACAO", data_limite_realizacao),
      now()
    );
    
    RETURN NULL; -- Bloquear inserção
  END IF;
  
  -- APLICAR REGRA V002: Rejeitar se DATA_LAUDO fora da janela permitida
  IF NEW."DATA_LAUDO" < data_inicio_janela_laudo OR NEW."DATA_LAUDO" > data_fim_janela_laudo THEN
    -- Log da exclusão para auditoria
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais,
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      NEW.arquivo_fonte,
      NEW.lote_upload,
      1,
      row_to_json(NEW),
      'REGRA_V002_TRIGGER', 
      format('DATA_LAUDO %s fora da janela %s - %s (regra v002)', NEW."DATA_LAUDO", data_inicio_janela_laudo, data_fim_janela_laudo),
      now()
    );
    
    RETURN NULL; -- Bloquear inserção
  END IF;
  
  -- Se passou em ambas as regras, permitir inserção
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger BEFORE INSERT para aplicar as regras v002/v003
DROP TRIGGER IF EXISTS trigger_aplicar_v002_v003 ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_v002_v003
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_v002_v003_trigger();