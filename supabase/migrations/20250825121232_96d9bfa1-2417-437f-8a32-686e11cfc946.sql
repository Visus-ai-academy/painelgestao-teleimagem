-- Atualizar trigger_aplicar_regras_completas com lógica de quebra correta
CREATE OR REPLACE FUNCTION public.trigger_aplicar_regras_completas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  novo_valor NUMERIC;
  categoria_encontrada TEXT;
  regras_quebra RECORD;
  registro_quebrado volumetria_mobilemed%ROWTYPE;
  tem_quebra BOOLEAN := false;
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
  
  -- 8. NOVA LÓGICA DE QUEBRA AUTOMÁTICA
  -- Verificar se existe regra de quebra para este exame
  FOR regras_quebra IN 
    SELECT exame_quebrado, categoria_quebrada 
    FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" 
      AND ativo = true
  LOOP
    tem_quebra := true;
    
    -- Copiar dados do registro original
    registro_quebrado := NEW;
    registro_quebrado.id := gen_random_uuid();
    registro_quebrado."ESTUDO_DESCRICAO" := regras_quebra.exame_quebrado;
    
    -- CORRIGIDO: Manter valor original (não dividir)
    registro_quebrado."VALORES" := NEW."VALORES";
    
    -- Aplicar categoria da quebra se definida
    IF regras_quebra.categoria_quebrada IS NOT NULL THEN
      registro_quebrado."CATEGORIA" := regras_quebra.categoria_quebrada;
    END IF;
    
    -- Marcar processamento como completo
    registro_quebrado.processamento_pendente := false;
    
    -- Inserir registro quebrado
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
     registro_quebrado."CATEGORIA", registro_quebrado.tipo_faturamento, 
     registro_quebrado.processamento_pendente);
  END LOOP;
  
  -- Se teve quebra, NÃO inserir o registro original (retornar NULL)
  IF tem_quebra THEN
    -- Log da quebra
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'QUEBRA_AUTOMATICA', NEW.id::text, 
            jsonb_build_object('exame_original', NEW."ESTUDO_DESCRICAO", 'tem_quebra', true),
            'system', 'info');
    
    RETURN NULL;
  END IF;
  
  -- Se não teve quebra, garantir que processamento_pendente seja false
  NEW.processamento_pendente := false;
  
  RETURN NEW;
END;
$function$;

-- Log da atualização
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('trigger_aplicar_regras_completas', 'UPDATE', 'quebra_automatica', 
        jsonb_build_object(
          'alteracao', 'Integrada quebra automática no trigger',
          'correcao_principal', 'Mantém valor original para cada quebra (não divide)',
          'nova_funcionalidade', 'Aplica categoria_quebrada do De-Para'
        ),
        'system', 'info');