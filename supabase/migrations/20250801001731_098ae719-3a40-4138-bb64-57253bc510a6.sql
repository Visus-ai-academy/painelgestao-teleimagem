-- Adicionar coluna CATEGORIA à tabela volumetria_mobilemed
ALTER TABLE public.volumetria_mobilemed 
ADD COLUMN "CATEGORIA" text;

-- Criar índice para melhorar performance nas consultas por categoria
CREATE INDEX idx_volumetria_categoria ON public.volumetria_mobilemed("CATEGORIA");

-- Função para aplicar categorias baseada em cadastro de exames e regras de quebra
CREATE OR REPLACE FUNCTION public.aplicar_categorias_volumetria()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_sc INTEGER := 0;
  resultado JSONB;
BEGIN
  -- 1. Aplicar categoria do cadastro de exames (match exato por ESTUDO_DESCRICAO)
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = ce.categoria,
      updated_at = now()
  FROM cadastro_exames ce
  WHERE vm."ESTUDO_DESCRICAO" = ce.nome
    AND ce.ativo = true
    AND ce.categoria IS NOT NULL
    AND ce.categoria != '';
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- 2. Aplicar categoria das regras de quebra (para exames quebrados)
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = rqe.categoria_quebrada,
      updated_at = now()
  FROM regras_quebra_exames rqe
  WHERE vm."ESTUDO_DESCRICAO" = rqe.exame_quebrado
    AND rqe.ativo = true
    AND rqe.categoria_quebrada IS NOT NULL
    AND rqe.categoria_quebrada != ''
    AND vm."CATEGORIA" IS NULL;
  
  -- 3. Definir "SC" para exames sem categoria identificada
  UPDATE volumetria_mobilemed vm
  SET "CATEGORIA" = 'SC',
      updated_at = now()
  WHERE vm."CATEGORIA" IS NULL OR vm."CATEGORIA" = '';
  
  GET DIAGNOSTICS registros_sc = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'aplicar_categorias', 
          jsonb_build_object(
            'registros_com_categoria', registros_atualizados, 
            'registros_sem_categoria', registros_sc
          ),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_com_categoria', registros_atualizados,
    'registros_sem_categoria', registros_sc,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;

-- Trigger para aplicar categoria automaticamente em novos registros
CREATE OR REPLACE FUNCTION public.aplicar_categoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Tentar buscar categoria do cadastro de exames
  SELECT ce.categoria INTO NEW."CATEGORIA"
  FROM cadastro_exames ce
  WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
    AND ce.ativo = true
    AND ce.categoria IS NOT NULL
    AND ce.categoria != ''
  LIMIT 1;
  
  -- Se não encontrou, tentar buscar nas regras de quebra
  IF NEW."CATEGORIA" IS NULL THEN
    SELECT rqe.categoria_quebrada INTO NEW."CATEGORIA"
    FROM regras_quebra_exames rqe
    WHERE rqe.exame_quebrado = NEW."ESTUDO_DESCRICAO"
      AND rqe.ativo = true
      AND rqe.categoria_quebrada IS NOT NULL
      AND rqe.categoria_quebrada != ''
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou categoria, definir como "SC"
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    NEW."CATEGORIA" := 'SC';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para aplicar categoria automaticamente
DROP TRIGGER IF EXISTS trigger_aplicar_categoria ON public.volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_categoria
  BEFORE INSERT OR UPDATE ON public.volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION public.aplicar_categoria_trigger();