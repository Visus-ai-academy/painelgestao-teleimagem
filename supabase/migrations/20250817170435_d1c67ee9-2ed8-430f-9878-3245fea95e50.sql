-- Primeiro, remover triggers antigos se existirem
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_marcar_para_quebra ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_limpar_nome_cliente ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_normalizar_medico ON volumetria_mobilemed;

-- Criar trigger principal que aplica TODAS as regras automaticamente
CREATE OR REPLACE FUNCTION public.trigger_volumetria_processamento_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Aplicar limpeza do nome do cliente (v022)
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Aplicar normalização do médico (extra_002)
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Aplicar regras de período (v002, v003, v031)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    NEW := aplicar_regras_retroativas(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  ELSE
    NEW := aplicar_regras_periodo_atual(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  END IF;
  
  -- 4. Aplicar correções de modalidade (v026, v030)
  NEW := aplicar_correcao_modalidades(NEW);
  
  -- 5. Aplicar categorias (v028)
  NEW := aplicar_categorias_trigger(NEW);
  
  -- 6. Aplicar de-para de prioridades (v029)
  NEW := aplicar_prioridades_de_para(NEW);
  
  -- 7. Aplicar de-para de valores (f005)
  NEW := aplicar_de_para_trigger(NEW);
  
  -- 8. Aplicar valor onco (extra_004)
  NEW := aplicar_valor_onco(NEW);
  
  -- 9. Aplicar tipificação de faturamento (f006)
  NEW := aplicar_tipificacao_faturamento(NEW);
  
  -- 10. Aplicar regras de exclusão dinâmicas (extra_005)
  NEW := aplicar_regras_exclusao_dinamicas(NEW);
  IF NEW IS NULL THEN RETURN NULL; END IF;
  
  -- 11. Marcar para quebra se necessário (v027)
  IF EXISTS (
    SELECT 1 FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
  ) THEN
    NEW.processamento_pendente = true;
  ELSE
    NEW.processamento_pendente = false;
  END IF;
  
  -- 12. Garantir data de referência (extra_008)
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia = NEW."DATA_REALIZACAO";
  END IF;
  
  -- 13. Definir especialidade se não tiver (extra_007)
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    -- Buscar especialidade do cadastro de exames
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
  
  -- Log da aplicação das regras
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'REGRAS_APLICADAS_AUTOMATICAMENTE', NEW.id::text, 
          jsonb_build_object(
            'arquivo_fonte', NEW.arquivo_fonte,
            'empresa', NEW."EMPRESA",
            'categoria', NEW."CATEGORIA",
            'tipo_faturamento', NEW.tipo_faturamento,
            'processamento_pendente', NEW.processamento_pendente
          ),
          'system', 'info');
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger na tabela volumetria_mobilemed
CREATE TRIGGER trigger_volumetria_processamento_completo
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_volumetria_processamento_completo();

-- Função para garantir que registros existentes sejam processados
CREATE OR REPLACE FUNCTION public.reprocessar_volumetria_sem_regras()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_reprocessados INTEGER := 0;
  registro RECORD;
  novo_registro volumetria_mobilemed%ROWTYPE;
BEGIN
  -- Buscar registros que precisam de reprocessamento
  FOR registro IN 
    SELECT * FROM volumetria_mobilemed 
    WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
    AND (
      processamento_pendente = true 
      OR "CATEGORIA" IS NULL 
      OR "CATEGORIA" = ''
      OR tipo_faturamento IS NULL 
      OR tipo_faturamento = ''
    )
  LOOP
    -- Criar uma cópia do registro para reprocessamento
    novo_registro := registro;
    
    -- Aplicar todas as funções manualmente (mesmo processo do trigger)
    novo_registro."EMPRESA" := limpar_nome_cliente(novo_registro."EMPRESA");
    novo_registro."MEDICO" := normalizar_medico(novo_registro."MEDICO");
    novo_registro := aplicar_correcao_modalidades(novo_registro);
    novo_registro := aplicar_categorias_trigger(novo_registro);
    novo_registro := aplicar_prioridades_de_para(novo_registro);
    novo_registro := aplicar_de_para_trigger(novo_registro);
    novo_registro := aplicar_valor_onco(novo_registro);
    novo_registro := aplicar_tipificacao_faturamento(novo_registro);
    
    -- Marcar para quebra se necessário
    IF EXISTS (
      SELECT 1 FROM regras_quebra_exames 
      WHERE exame_original = novo_registro."ESTUDO_DESCRICAO" AND ativo = true
    ) THEN
      novo_registro.processamento_pendente = true;
    ELSE
      novo_registro.processamento_pendente = false;
    END IF;
    
    -- Garantir especialidade
    IF novo_registro."ESPECIALIDADE" IS NULL OR novo_registro."ESPECIALIDADE" = '' THEN
      SELECT ce.especialidade INTO novo_registro."ESPECIALIDADE"
      FROM cadastro_exames ce
      WHERE ce.nome = novo_registro."ESTUDO_DESCRICAO"
        AND ce.ativo = true
        AND ce.especialidade IS NOT NULL
        AND ce.especialidade != ''
      LIMIT 1;
      
      IF novo_registro."ESPECIALIDADE" IS NULL OR novo_registro."ESPECIALIDADE" = '' THEN
        novo_registro.especialidade := 'GERAL';
      END IF;
    END IF;
    
    -- Atualizar o registro (sem trigger para evitar loop)
    ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_volumetria_processamento_completo;
    
    UPDATE volumetria_mobilemed SET 
      "EMPRESA" = novo_registro."EMPRESA",
      "MEDICO" = novo_registro."MEDICO",
      "MODALIDADE" = novo_registro."MODALIDADE",
      "CATEGORIA" = novo_registro."CATEGORIA",
      "PRIORIDADE" = novo_registro."PRIORIDADE",
      "VALORES" = novo_registro."VALORES",
      "ESPECIALIDADE" = novo_registro."ESPECIALIDADE",
      tipo_faturamento = novo_registro.tipo_faturamento,
      processamento_pendente = novo_registro.processamento_pendente,
      updated_at = now()
    WHERE id = registro.id;
    
    ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_volumetria_processamento_completo;
    
    total_reprocessados := total_reprocessados + 1;
  END LOOP;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'REPROCESSAMENTO_REGRAS_COMPLETO', 
          'BULK_OPERATION',
          jsonb_build_object('total_reprocessados', total_reprocessados),
          'system', 'info');
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'total_reprocessados', total_reprocessados,
    'data_processamento', now()
  );
END;
$function$;