-- Criar trigger para aplicar regras automaticamente na volumetria_mobilemed
CREATE OR REPLACE FUNCTION public.trigger_aplicar_regras_completas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  novo_valor NUMERIC;
  categoria_encontrada TEXT;
BEGIN
  -- 1. Normalizar nome do cliente
  IF NEW."EMPRESA" IS NOT NULL THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Aplicar correção de modalidades
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
  
  -- 3. Aplicar De-Para para valores zerados
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
  
  -- 4. Aplicar categoria do cadastro de exames
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
  
  -- 5. Categoria especial para arquivo onco
  IF NEW.arquivo_fonte = 'volumetria_onco_padrao' THEN
    NEW."CATEGORIA" := 'Onco';
  END IF;
  
  -- 6. Definir tipo de faturamento
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
    NEW.tipo_faturamento := 'urgencia';
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  -- 7. Normalizar médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 8. Garantir que processamento_pendente seja false (sem quebras pendentes)
  NEW.processamento_pendente := false;
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger na tabela volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_regras_completas ON volumetria_mobilemed;
CREATE TRIGGER trigger_regras_completas
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_regras_completas();