-- Corrigir o trigger de processamento volumetria
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- Criar função de trigger corrigida
CREATE OR REPLACE FUNCTION trigger_volumetria_processamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar regras de período (retroativo vs atual)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    NEW := aplicar_regras_retroativas(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  ELSE
    NEW := aplicar_regras_periodo_atual(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  END IF;
  
  -- Aplicar regras de exclusão dinâmicas
  NEW := aplicar_regras_exclusao_dinamicas(NEW);
  IF NEW IS NULL THEN RETURN NULL; END IF;
  
  -- Aplicar correções de modalidade
  NEW := aplicar_correcao_modalidades(NEW);
  
  -- Aplicar categorias
  NEW := aplicar_categorias_trigger(NEW);
  
  -- Aplicar de-para de prioridades
  NEW := aplicar_prioridades_de_para(NEW);
  
  -- Aplicar de-para de valores
  NEW := aplicar_de_para_trigger(NEW);
  
  -- Aplicar valor onco
  NEW := aplicar_valor_onco(NEW);
  
  -- Aplicar tipificação de faturamento
  NEW := aplicar_tipificacao_faturamento(NEW);
  
  -- IMPORTANTE: Aplicar quebra de exames por último
  -- Isso permitirá que a quebra seja aplicada após todas as outras regras
  PERFORM aplicar_quebra_exames_processamento(NEW);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger
CREATE TRIGGER trigger_volumetria_processamento
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_volumetria_processamento();