-- Recriar as funções e triggers que estão faltando

-- 1. Função para regras básicas
CREATE OR REPLACE FUNCTION public.aplicar_regras_basicas_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Limpeza do nome do cliente
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Normalização do médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Correções de modalidade
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" ILIKE '%MAMOGRAFIA%' THEN
      NEW."MODALIDADE" := 'MG';
    ELSE
      NEW."MODALIDADE" := 'RX';
    END IF;
  ELSIF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
  ELSIF NEW."MODALIDADE" = 'BMD' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- 4. Aplicar especialidades baseadas na modalidade se vazia
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    CASE NEW."MODALIDADE"
      WHEN 'CT' THEN NEW."ESPECIALIDADE" := 'CT';
      WHEN 'MR' THEN NEW."ESPECIALIDADE" := 'RM';
      WHEN 'RX' THEN NEW."ESPECIALIDADE" := 'RX';
      WHEN 'US' THEN NEW."ESPECIALIDADE" := 'US';
      WHEN 'MG' THEN NEW."ESPECIALIDADE" := 'MG';
      WHEN 'DO' THEN NEW."ESPECIALIDADE" := 'DO';
      ELSE NEW."ESPECIALIDADE" := 'GERAL';
    END CASE;
  END IF;
  
  -- 5. Aplicar categorias do cadastro de exames se vazia
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' OR NEW."CATEGORIA" = '—' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    -- Se ainda não encontrou categoria, usar padrão baseado na modalidade
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' OR NEW."CATEGORIA" = '—' THEN
      CASE NEW."MODALIDADE"
        WHEN 'DO' THEN NEW."CATEGORIA" := 'DO';
        WHEN 'MG' THEN NEW."CATEGORIA" := 'MG';
        ELSE NEW."CATEGORIA" := 'SC';
      END CASE;
    END IF;
  END IF;
  
  -- 6. Aplicar De-Para de Prioridades
  DECLARE
    nova_prioridade TEXT;
  BEGIN
    SELECT vp.nome_final INTO nova_prioridade
    FROM valores_prioridade_de_para vp
    WHERE vp.prioridade_original = NEW."PRIORIDADE"
      AND vp.ativo = true
    LIMIT 1;
    
    IF nova_prioridade IS NOT NULL THEN
      NEW."PRIORIDADE" := nova_prioridade;
    END IF;
  END;
  
  -- 7. Garantir campos obrigatórios
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := NEW."DATA_REALIZACAO";
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Função para fila de processamento avançado
CREATE OR REPLACE FUNCTION public.trigger_fila_processamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tipos_necessarios text[] := '{}';
BEGIN
  -- Determinar que tipos de processamento avançado são necessários
  
  -- Verificar se precisa de quebra de exames
  IF EXISTS (
    SELECT 1 FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
  ) THEN
    tipos_necessarios := array_append(tipos_necessarios, 'quebras');
  END IF;
  
  -- Verificar se precisa de processamento de valor ONCO
  IF NEW."CATEGORIA" IN ('ONCO', 'Onco', 'onco') AND COALESCE(NEW."VALORES", 0) = 0 THEN
    tipos_necessarios := array_append(tipos_necessarios, 'valor_onco');
  END IF;
  
  -- Verificar se precisa de regras de exclusão específicas
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    tipos_necessarios := array_append(tipos_necessarios, 'exclusoes');
  END IF;
  
  -- Se há processamento avançado necessário, adicionar à fila
  IF array_length(tipos_necessarios, 1) > 0 THEN
    INSERT INTO fila_processamento_avancado (
      volumetria_id,
      arquivo_fonte,
      lote_upload,
      tipos_processamento,
      prioridade,
      status
    ) VALUES (
      NEW.id,
      NEW.arquivo_fonte,
      NEW.lote_upload,
      tipos_necessarios,
      CASE WHEN array_length(tipos_necessarios, 1) > 2 THEN 'alta' ELSE 'normal' END,
      'pendente'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Recriar os triggers
DROP TRIGGER IF EXISTS trigger_regras_basicas ON volumetria_mobilemed;
CREATE TRIGGER trigger_regras_basicas
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_basicas_trigger();

DROP TRIGGER IF EXISTS trigger_fila_avancado ON volumetria_mobilemed;  
CREATE TRIGGER trigger_fila_avancado
  AFTER INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fila_processamento();

-- 4. Manter apenas o trigger v002/v003 para retroativos
DROP TRIGGER IF EXISTS trigger_regras_v002_v003 ON volumetria_mobilemed;
CREATE TRIGGER trigger_regras_v002_v003
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  WHEN (NEW.arquivo_fonte LIKE '%retroativo%')
  EXECUTE FUNCTION aplicar_regras_v002_v003_trigger();