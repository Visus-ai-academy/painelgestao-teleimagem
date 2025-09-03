-- Atualizar função aplicar_regras_completas_trigger para incluir correção de especialidades problemáticas (v007)
CREATE OR REPLACE FUNCTION public.aplicar_regras_completas_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nova_prioridade TEXT;
  valor_referencia NUMERIC;
BEGIN
  -- Só aplicar para arquivos que NÃO são retroativos (v002/v003 já cuida dos retroativos)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    RETURN NEW; -- Para retroativos, só v002/v003 são aplicadas
  END IF;
  
  -- 1. Aplicar limpeza do nome do cliente
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Aplicar normalização do médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Aplicar correções de modalidade
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
  
  -- 4. Aplicar categorias
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidades
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      NEW."ESPECIALIDADE" := 'GERAL';
    END IF;
  END IF;

  -- 5.1. REGRA v007: Aplicar correções de especialidades problemáticas
  IF NEW."ESPECIALIDADE" = 'COLUNAS' THEN
    NEW."ESPECIALIDADE" := 'MUSCULO ESQUELETICO';
  END IF;
  
  IF NEW."ESPECIALIDADE" = 'ONCO MEDICINA INTERNA' THEN
    NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
  END IF;

  -- 6. Aplicar De-Para de Prioridades
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  -- 7. Aplicar De-Para de Valores (para valores zerados)
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE UPPER(TRIM(vr.estudo_descricao)) = UPPER(TRIM(NEW."ESTUDO_DESCRICAO"))
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      NEW."VALORES" := valor_referencia;
    END IF;
  END IF;
  
  -- 8. Aplicar tipificação de faturamento
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
  
  -- 9. Garantir data de referência
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := NEW."DATA_REALIZACAO";
  END IF;
  
  -- 10. Marcar para quebra se necessário (será processado por função separada)
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