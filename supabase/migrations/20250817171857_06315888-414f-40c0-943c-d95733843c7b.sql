-- Verificar e corrigir o trigger para garantir aplicação automática das regras

-- 1. Verificar se existem dados não processados
CREATE OR REPLACE FUNCTION public.verificar_dados_nao_processados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sem_categoria INTEGER := 0;
  sem_tipificacao INTEGER := 0;
  sem_especialidade INTEGER := 0;
  pendente_quebra INTEGER := 0;
  sem_data_referencia INTEGER := 0;
  resultado jsonb;
BEGIN
  -- Verificar registros sem categoria
  SELECT COUNT(*) INTO sem_categoria
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
  AND (vm."CATEGORIA" IS NULL OR vm."CATEGORIA" = '');
  
  -- Verificar registros sem tipificação
  SELECT COUNT(*) INTO sem_tipificacao
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
  AND (vm.tipo_faturamento IS NULL OR vm.tipo_faturamento = '');
  
  -- Verificar registros sem especialidade
  SELECT COUNT(*) INTO sem_especialidade
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
  AND (vm."ESPECIALIDADE" IS NULL OR vm."ESPECIALIDADE" = '');
  
  -- Verificar registros pendentes de quebra
  SELECT COUNT(*) INTO pendente_quebra
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
  AND vm.processamento_pendente = true;
  
  -- Verificar registros sem data de referência
  SELECT COUNT(*) INTO sem_data_referencia
  FROM volumetria_mobilemed vm
  WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
  AND vm.data_referencia IS NULL;
  
  resultado := jsonb_build_object(
    'sem_categoria', sem_categoria,
    'sem_tipificacao', sem_tipificacao,
    'sem_especialidade', sem_especialidade,
    'pendente_quebra', pendente_quebra,
    'sem_data_referencia', sem_data_referencia,
    'total_problemas', sem_categoria + sem_tipificacao + sem_especialidade + pendente_quebra + sem_data_referencia,
    'timestamp', now()
  );
  
  RETURN resultado;
END;
$function$;

-- 2. Garantir que o trigger está funcionando - recriar se necessário
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

CREATE TRIGGER trigger_volumetria_processamento_completo
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_volumetria_processamento_completo();

-- 3. Executar correção automática de dados existentes
DO $$
DECLARE
  total_corrigidos INTEGER := 0;
  registro RECORD;
  novo_registro volumetria_mobilemed%ROWTYPE;
BEGIN
  -- Processar registros com problemas
  FOR registro IN 
    SELECT * FROM volumetria_mobilemed vm
    WHERE vm.arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
    AND (
      vm."CATEGORIA" IS NULL OR vm."CATEGORIA" = '' OR
      vm.tipo_faturamento IS NULL OR vm.tipo_faturamento = '' OR
      vm."ESPECIALIDADE" IS NULL OR vm."ESPECIALIDADE" = '' OR
      vm.data_referencia IS NULL OR
      vm.processamento_pendente = true
    )
  LOOP
    -- Aplicar todas as correções manualmente
    novo_registro := registro;
    
    -- Limpeza de nome
    novo_registro."EMPRESA" := limpar_nome_cliente(novo_registro."EMPRESA");
    
    -- Normalização de médico
    novo_registro."MEDICO" := normalizar_medico(novo_registro."MEDICO");
    
    -- Correção de modalidades
    IF novo_registro."MODALIDADE" IN ('CR', 'DX') THEN
      IF novo_registro."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
        novo_registro."MODALIDADE" := 'MG';
      ELSE
        novo_registro."MODALIDADE" := 'RX';
      END IF;
    END IF;
    
    IF novo_registro."MODALIDADE" = 'OT' THEN
      novo_registro."MODALIDADE" := 'DO';
    END IF;
    
    -- Aplicar categoria
    IF novo_registro."CATEGORIA" IS NULL OR novo_registro."CATEGORIA" = '' THEN
      SELECT ce.categoria INTO novo_registro."CATEGORIA"
      FROM cadastro_exames ce
      WHERE ce.nome = novo_registro."ESTUDO_DESCRICAO"
        AND ce.ativo = true
        AND ce.categoria IS NOT NULL
        AND ce.categoria != ''
      LIMIT 1;
      
      IF novo_registro."CATEGORIA" IS NULL OR novo_registro."CATEGORIA" = '' THEN
        novo_registro."CATEGORIA" := 'SC';
      END IF;
    END IF;
    
    -- Aplicar especialidade
    IF novo_registro."ESPECIALIDADE" IS NULL OR novo_registro."ESPECIALIDADE" = '' THEN
      SELECT ce.especialidade INTO novo_registro."ESPECIALIDADE"
      FROM cadastro_exames ce
      WHERE ce.nome = novo_registro."ESTUDO_DESCRICAO"
        AND ce.ativo = true
        AND ce.especialidade IS NOT NULL
        AND ce.especialidade != ''
      LIMIT 1;
      
      IF novo_registro."ESPECIALIDADE" IS NULL OR novo_registro."ESPECIALIDADE" = '' THEN
        novo_registro."ESPECIALIDADE" := 'GERAL';
      END IF;
    END IF;
    
    -- Aplicar tipificação
    IF novo_registro."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
      novo_registro.tipo_faturamento := 'oncologia';
    ELSIF novo_registro."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
      novo_registro.tipo_faturamento := 'urgencia';
    ELSIF novo_registro."MODALIDADE" IN ('CT', 'MR') THEN
      novo_registro.tipo_faturamento := 'alta_complexidade';
    ELSE
      novo_registro.tipo_faturamento := 'padrao';
    END IF;
    
    -- Garantir data de referência
    IF novo_registro.data_referencia IS NULL THEN
      novo_registro.data_referencia := novo_registro."DATA_REALIZACAO";
    END IF;
    
    -- Verificar quebra
    IF EXISTS (
      SELECT 1 FROM regras_quebra_exames 
      WHERE exame_original = novo_registro."ESTUDO_DESCRICAO" AND ativo = true
    ) THEN
      novo_registro.processamento_pendente := true;
    ELSE
      novo_registro.processamento_pendente := false;
    END IF;
    
    -- Atualizar o registro (desabilitar trigger temporariamente)
    ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_volumetria_processamento_completo;
    
    UPDATE volumetria_mobilemed SET 
      "EMPRESA" = novo_registro."EMPRESA",
      "MEDICO" = novo_registro."MEDICO",
      "MODALIDADE" = novo_registro."MODALIDADE",
      "CATEGORIA" = novo_registro."CATEGORIA",
      "ESPECIALIDADE" = novo_registro."ESPECIALIDADE",
      tipo_faturamento = novo_registro.tipo_faturamento,
      data_referencia = novo_registro.data_referencia,
      processamento_pendente = novo_registro.processamento_pendente,
      updated_at = now()
    WHERE id = registro.id;
    
    ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_volumetria_processamento_completo;
    
    total_corrigidos := total_corrigidos + 1;
  END LOOP;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'CORRECAO_AUTOMATICA_REGRAS', 
          'BULK_OPERATION',
          jsonb_build_object('total_corrigidos', total_corrigidos),
          'system', 'info');
          
  RAISE NOTICE 'Correção automática concluída: % registros corrigidos', total_corrigidos;
END
$$;