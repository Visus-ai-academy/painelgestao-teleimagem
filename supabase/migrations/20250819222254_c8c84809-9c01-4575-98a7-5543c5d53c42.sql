-- Corrigir função aplicar_regras_automaticas_volumetria com a estrutura correta das tabelas
CREATE OR REPLACE FUNCTION public.aplicar_regras_automaticas_volumetria()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- REGRA: Aplicar limpeza de nome do cliente
  IF NEW."EMPRESA" IS NOT NULL THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- REGRA: Aplicar normalização do médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- REGRA: Correção automática de modalidades
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
      NEW."MODALIDADE" := 'MG';
    ELSE
      NEW."MODALIDADE" := 'RX';
    END IF;
  END IF;
  
  -- REGRA: Correção OT para DO
  IF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- REGRA: Aplicar categoria do cadastro de exames se não tiver
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    -- Se não encontrou, definir como "SC"
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- REGRA: Aplicar de-para de prioridades (CORRIGIDO - tabela e colunas corretas)
  SELECT vp.nome_final INTO NEW."PRIORIDADE"
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  -- Se não encontrou mapeamento, manter prioridade original
  IF NEW."PRIORIDADE" IS NULL OR NEW."PRIORIDADE" = '' THEN
    NEW."PRIORIDADE" := 'ROTINA'; -- valor padrão
  END IF;
  
  -- REGRA: Aplicar de-para de valores se VALORES for zero ou nulo
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO NEW."VALORES"
    FROM valores_referencia_de_para vr
    WHERE vr.estudo_descricao = NEW."ESTUDO_DESCRICAO"
      AND vr.ativo = true
    LIMIT 1;
  END IF;
  
  -- REGRA: Aplicar tipificação de faturamento
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA', 'URGÊNCIA') THEN
    NEW.tipo_faturamento := 'urgencia';
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  RETURN NEW;
END;
$function$;