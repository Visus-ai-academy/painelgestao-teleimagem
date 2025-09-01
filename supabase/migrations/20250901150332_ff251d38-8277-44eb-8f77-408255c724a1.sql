-- Recriar triggers para aplicação automática de regras na volumetria_mobilemed

-- 1. Trigger para aplicar regras básicas automaticamente
CREATE OR REPLACE FUNCTION public.aplicar_regras_basicas_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nova_prioridade TEXT;
  valor_referencia NUMERIC;
BEGIN
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
  
  IF NEW."MODALIDADE" = 'BMD' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- 4. Aplicar categorias
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' OR NEW."CATEGORIA" = '—' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' OR NEW."CATEGORIA" = '—' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidades
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' 
     OR NEW."ESPECIALIDADE" IN ('Colunas', 'CT', 'ONCO MEDICINA INTERNA') THEN
    
    -- Primeiro tentar do cadastro de exames
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    -- Se não encontrou, aplicar regras por modalidade
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' 
       OR NEW."ESPECIALIDADE" IN ('Colunas', 'CT', 'ONCO MEDICINA INTERNA') THEN
      
      CASE NEW."MODALIDADE"
        WHEN 'CT' THEN NEW."ESPECIALIDADE" := 'TOMOGRAFIA';
        WHEN 'MR' THEN NEW."ESPECIALIDADE" := 'RESSONANCIA';
        WHEN 'US' THEN NEW."ESPECIALIDADE" := 'ULTRASSOM';
        WHEN 'MG' THEN NEW."ESPECIALIDADE" := 'MAMOGRAFIA';
        WHEN 'RX' THEN NEW."ESPECIALIDADE" := 'RADIOLOGIA';
        WHEN 'DO' THEN NEW."ESPECIALIDADE" := 'DENSITOMETRIA';
        ELSE NEW."ESPECIALIDADE" := 'GERAL';
      END CASE;
    END IF;
  END IF;

  -- 6. Aplicar De-Para de Prioridades
  IF NEW."PRIORIDADE" = 'INTERNADO' OR NEW."PRIORIDADE" IS NULL OR NEW."PRIORIDADE" = '' THEN
    -- Buscar no de-para se existir
    SELECT vp.nome_final INTO nova_prioridade
    FROM valores_prioridade_de_para vp
    WHERE vp.prioridade_original = NEW."PRIORIDADE"
      AND vp.ativo = true
    LIMIT 1;
    
    IF nova_prioridade IS NOT NULL THEN
      NEW."PRIORIDADE" := nova_prioridade;
    ELSE
      NEW."PRIORIDADE" := 'normal';
    END IF;
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
  
  RETURN NEW;
END;
$function$;

-- 2. Criar trigger que executa BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_aplicar_regras_basicas ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_regras_basicas
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_basicas_trigger();

-- 3. Log da criação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CRIAR_TRIGGERS', 'sistema', 
        jsonb_build_object('trigger', 'aplicar_regras_basicas', 'status', 'criado'),
        'system', 'info');