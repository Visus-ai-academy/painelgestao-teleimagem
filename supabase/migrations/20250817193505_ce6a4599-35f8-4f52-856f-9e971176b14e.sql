-- Corrigir trigger para aplicar quebras automaticamente
CREATE OR REPLACE FUNCTION public.trigger_volumetria_processamento()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
  
  -- Marcar processamento como completo (sem quebras pendentes)
  NEW.processamento_pendente := false;
  
  RETURN NEW;
END;
$function$;