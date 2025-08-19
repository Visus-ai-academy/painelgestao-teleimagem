-- Corrigir função De-Para Prioridades para usar a tabela e campos corretos
CREATE OR REPLACE FUNCTION public.aplicar_prioridades_de_para()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  nova_prioridade TEXT;
BEGIN
  -- Aplicar mapeamento de prioridades usando a tabela correta
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Verificar se o trigger existe e criar se necessário
DROP TRIGGER IF EXISTS trigger_aplicar_de_para_prioridade ON volumetria_mobilemed;

CREATE TRIGGER trigger_aplicar_de_para_prioridade
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW 
  EXECUTE FUNCTION aplicar_prioridades_de_para();

-- Atualizar a função de processamento completo para incluir de-para de prioridades
CREATE OR REPLACE FUNCTION public.trigger_volumetria_processamento_completo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  nova_prioridade TEXT;
BEGIN
  -- 1. Aplicar limpeza do nome do cliente (v022)
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Aplicar normalização do médico (extra_002)
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Aplicar correções de modalidade (v026, v030)
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
  
  -- 4. Aplicar categorias (v028)
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    -- Se ainda não tem categoria, definir como "SC"
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidades (extra_007)
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    -- Se ainda não tiver, definir como 'GERAL'
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      NEW."ESPECIALIDADE" := 'GERAL';
    END IF;
  END IF;

  -- 6. Aplicar De-Para de Prioridades (v018) - CORRIGIDO
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  -- 7. Aplicar tipificação de faturamento (f006)
  IF NEW.tipo_faturamento IS NULL OR NEW.tipo_faturamento = '' THEN
    IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
      NEW.tipo_faturamento := 'oncologia';
    ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
      NEW.tipo_faturamento := 'urgencia';
    ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
      NEW.tipo_faturamento := 'alta_complexidade';
    ELSE
      NEW.tipo_faturamento := 'padrao';
    END IF;
  END IF;
  
  -- 8. Garantir data de referência (extra_008)
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := NEW."DATA_REALIZACAO";
  END IF;
  
  -- 9. Marcar para quebra se necessário (v027)
  IF EXISTS (
    SELECT 1 FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
  ) THEN
    NEW.processamento_pendente := true;
  ELSE
    NEW.processamento_pendente := false;
  END IF;
  
  RETURN NEW;
END;
$function$;