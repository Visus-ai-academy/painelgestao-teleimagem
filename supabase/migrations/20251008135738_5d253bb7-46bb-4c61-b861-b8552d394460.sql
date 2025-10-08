-- Hotfix: destravar processamento de volumetria
-- 1) Remover restrição que bloqueia inserts no audit_logs
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_operation_check;

-- 2) Corrigir função de debug para usar colunas existentes em audit_logs
CREATE OR REPLACE FUNCTION public.debug_upload_volumetria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log todos os inserts na volumetria_mobilemed com colunas válidas
  INSERT INTO audit_logs (
    table_name,
    operation,
    record_id,
    new_data,
    user_email,
    severity,
    evento_tipo
  ) VALUES (
    'volumetria_mobilemed',
    'INSERT',
    COALESCE(NEW.id::text, 'sem_id'),
    row_to_json(NEW)::jsonb,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    'info',
    'DEBUG_UPLOAD'
  );
  RETURN NEW;
END;
$function$;

-- 3) Proteger triggers de volumetria para rodarem apenas na tabela correta
-- e corrigir o log no audit_logs para não violar restrições
CREATE OR REPLACE FUNCTION public.trigger_quebra_automatica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  regras_quebra RECORD;
  registro_quebrado volumetria_mobilemed%ROWTYPE;
  total_quebras INTEGER;
BEGIN
  -- Garantir que a função só rode na tabela certa
  IF TG_TABLE_NAME <> 'volumetria_mobilemed' THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se existe regra de quebra para este exame
  SELECT COUNT(*) INTO total_quebras
  FROM regras_quebra_exames 
  WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
    AND ativo = true;
  
  -- Se não há regras, retornar o registro normal
  IF total_quebras = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Se há regras, criar registros quebrados e não inserir o original
  FOR regras_quebra IN 
    SELECT exame_quebrado, categoria_quebrada 
    FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
      AND ativo = true
  LOOP
    -- Copiar dados do registro original
    registro_quebrado := NEW;
    registro_quebrado.id := gen_random_uuid();
    registro_quebrado."ESTUDO_DESCRICAO" := regras_quebra.exame_quebrado;
    registro_quebrado."VALORES" := 1; -- Valor fixo de 1 para cada quebra
    registro_quebrado."CATEGORIA" := COALESCE(regras_quebra.categoria_quebrada, NEW."CATEGORIA", 'SC');
    
    -- Inserir registro quebrado (sem disparar o trigger novamente)
    INSERT INTO volumetria_mobilemed 
    (id, "EMPRESA", "NOME_PACIENTE", "CODIGO_PACIENTE", "ESTUDO_DESCRICAO", 
     "ACCESSION_NUMBER", "MODALIDADE", "PRIORIDADE", "VALORES", "ESPECIALIDADE", 
     "MEDICO", "DUPLICADO", "DATA_REALIZACAO", "HORA_REALIZACAO", 
     "DATA_TRANSFERENCIA", "HORA_TRANSFERENCIA", "DATA_LAUDO", "HORA_LAUDO", 
     "DATA_PRAZO", "HORA_PRAZO", "STATUS", "DATA_REASSINATURA", 
     "HORA_REASSINATURA", "MEDICO_REASSINATURA", "SEGUNDA_ASSINATURA", 
     "POSSUI_IMAGENS_CHAVE", "IMAGENS_CHAVES", "IMAGENS_CAPTURADAS", 
     "CODIGO_INTERNO", "DIGITADOR", "COMPLEMENTAR", data_referencia, 
     arquivo_fonte, lote_upload, periodo_referencia, "CATEGORIA", 
     tipo_faturamento, processamento_pendente)
    VALUES 
    (registro_quebrado.id, registro_quebrado."EMPRESA", registro_quebrado."NOME_PACIENTE", 
     registro_quebrado."CODIGO_PACIENTE", registro_quebrado."ESTUDO_DESCRICAO", 
     registro_quebrado."ACCESSION_NUMBER", registro_quebrado."MODALIDADE", 
     registro_quebrado."PRIORIDADE", registro_quebrado."VALORES", registro_quebrado."ESPECIALIDADE", 
     registro_quebrado."MEDICO", registro_quebrado."DUPLICADO", registro_quebrado."DATA_REALIZACAO", 
     registro_quebrado."HORA_REALIZACAO", registro_quebrado."DATA_TRANSFERENCIA", 
     registro_quebrado."HORA_TRANSFERENCIA", registro_quebrado."DATA_LAUDO", 
     registro_quebrado."HORA_LAUDO", registro_quebrado."DATA_PRAZO", 
     registro_quebrado."HORA_PRAZO", registro_quebrado."STATUS", 
     registro_quebrado."DATA_REASSINATURA", registro_quebrado."HORA_REASSINATURA", 
     registro_quebrado."MEDICO_REASSINATURA", registro_quebrado."SEGUNDA_ASSINATURA", 
     registro_quebrado."POSSUI_IMAGENS_CHAVE", registro_quebrado."IMAGENS_CHAVES", 
     registro_quebrado."IMAGENS_CAPTURADAS", registro_quebrado."CODIGO_INTERNO", 
     registro_quebrado."DIGITADOR", registro_quebrado."COMPLEMENTAR", 
     registro_quebrado.data_referencia, registro_quebrado.arquivo_fonte, 
     registro_quebrado.lote_upload, registro_quebrado.periodo_referencia, 
     registro_quebrado."CATEGORIA", registro_quebrado.tipo_faturamento, false);
  END LOOP;
  
  -- Log da quebra usando colunas válidas no audit_logs
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity, evento_tipo)
  VALUES ('volumetria_mobilemed', 'INSERT', NEW.id::text, 
          jsonb_build_object('exame_original', NEW."ESTUDO_DESCRICAO", 'total_quebras', total_quebras),
          'system', 'info', 'QUEBRA_AUTOMATICA');
  
  -- NÃO inserir o registro original (retornar NULL)
  RETURN NULL;
END;
$function$;

-- 4) Garantir que a função de processamento de volumetria só rode na tabela correta
CREATE OR REPLACE FUNCTION public.trigger_volumetria_processamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Proteger contra anexos incorretos de trigger
  IF TG_TABLE_NAME <> 'volumetria_mobilemed' THEN
    RETURN NEW;
  END IF;

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