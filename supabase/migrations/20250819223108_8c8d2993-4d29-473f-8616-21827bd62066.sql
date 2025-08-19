-- Criar função RPC get_clientes_stats_completos que está sendo chamada no contexto
CREATE OR REPLACE FUNCTION public.get_clientes_stats_completos()
 RETURNS TABLE(
   empresa text,
   total_registros bigint,
   total_exames numeric,
   total_atrasados numeric,
   percentual_atraso numeric,
   modalidades text[],
   especialidades text[],
   medicos text[],
   arquivo_fonte text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    vm."EMPRESA",
    COUNT(*) as total_registros,
    COALESCE(SUM(vm."VALORES"), 0) as total_exames,
    COALESCE(SUM(CASE WHEN 
      vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
      vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
      (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
      THEN vm."VALORES" ELSE 0 END), 0) as total_atrasados,
    CASE 
      WHEN COALESCE(SUM(vm."VALORES"), 0) > 0 THEN 
        ROUND((COALESCE(SUM(CASE WHEN 
          vm."DATA_LAUDO" IS NOT NULL AND vm."HORA_LAUDO" IS NOT NULL AND 
          vm."DATA_PRAZO" IS NOT NULL AND vm."HORA_PRAZO" IS NOT NULL AND
          (vm."DATA_LAUDO"::date + vm."HORA_LAUDO"::time) > (vm."DATA_PRAZO"::date + vm."HORA_PRAZO"::time)
          THEN vm."VALORES" ELSE 0 END), 0) * 100.0 / COALESCE(SUM(vm."VALORES"), 0)), 1)
      ELSE 0
    END as percentual_atraso,
    ARRAY_AGG(DISTINCT vm."MODALIDADE") FILTER (WHERE vm."MODALIDADE" IS NOT NULL) as modalidades,
    ARRAY_AGG(DISTINCT vm."ESPECIALIDADE") FILTER (WHERE vm."ESPECIALIDADE" IS NOT NULL) as especialidades,
    ARRAY_AGG(DISTINCT vm."MEDICO") FILTER (WHERE vm."MEDICO" IS NOT NULL) as medicos,
    STRING_AGG(DISTINCT vm.arquivo_fonte, ', ') as arquivo_fonte
  FROM volumetria_mobilemed vm
  WHERE vm."EMPRESA" IS NOT NULL
    AND vm.arquivo_fonte NOT IN ('volumetria_onco_padrao')  -- Excluir onco dos stats gerais
  GROUP BY vm."EMPRESA"
  ORDER BY total_exames DESC;
END;
$function$;

-- Criar trigger para aplicar regras automaticamente na volumetria_mobilemed
CREATE OR REPLACE FUNCTION public.trigger_aplicar_regras_completas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  novo_valor NUMERIC;
  categoria_encontrada TEXT;
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
  
  -- 8. Garantir que processamento_pendente seja false (sem quebras pendentes)
  NEW.processamento_pendente := false;
  
  RETURN NEW;
END;
$function$;

-- Criar o trigger na tabela volumetria_mobilemed
DROP TRIGGER IF EXISTS trigger_regras_completas ON volumetria_mobilemed;
CREATE TRIGGER trigger_regras_completas
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_regras_completas();

-- Criar trigger para aplicar regras na volumetria_staging também
CREATE OR REPLACE FUNCTION public.trigger_staging_to_final()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Quando um registro for marcado como concluído no staging,
  -- aplicar as regras e mover para a tabela final
  IF NEW.status_processamento = 'processado' AND OLD.status_processamento != 'processado' THEN
    -- Inserir na tabela final com regras aplicadas automaticamente via trigger
    INSERT INTO volumetria_mobilemed (
      "EMPRESA", "NOME_PACIENTE", "CODIGO_PACIENTE", "ESTUDO_DESCRICAO",
      "ACCESSION_NUMBER", "MODALIDADE", "PRIORIDADE", "VALORES", "ESPECIALIDADE",
      "MEDICO", "DUPLICADO", "DATA_REALIZACAO", "HORA_REALIZACAO",
      "DATA_TRANSFERENCIA", "HORA_TRANSFERENCIA", "DATA_LAUDO", "HORA_LAUDO",
      "DATA_PRAZO", "HORA_PRAZO", "STATUS", "DATA_REASSINATURA",
      "HORA_REASSINATURA", "MEDICO_REASSINATURA", "SEGUNDA_ASSINATURA",
      "POSSUI_IMAGENS_CHAVE", "IMAGENS_CHAVES", "IMAGENS_CAPTURADAS",
      "CODIGO_INTERNO", "DIGITADOR", "COMPLEMENTAR", "CATEGORIA",
      data_referencia, arquivo_fonte, lote_upload, periodo_referencia,
      tipo_faturamento, processamento_pendente
    ) VALUES (
      NEW."EMPRESA", NEW."NOME_PACIENTE", NEW."CODIGO_PACIENTE", NEW."ESTUDO_DESCRICAO",
      NEW."ACCESSION_NUMBER", NEW."MODALIDADE", NEW."PRIORIDADE", NEW."VALORES", NEW."ESPECIALIDADE",
      NEW."MEDICO", NEW."DUPLICADO", NEW."DATA_REALIZACAO", NEW."HORA_REALIZACAO",
      NEW."DATA_TRANSFERENCIA", NEW."HORA_TRANSFERENCIA", NEW."DATA_LAUDO", NEW."HORA_LAUDO",
      NEW."DATA_PRAZO", NEW."HORA_PRAZO", NEW."STATUS", NEW."DATA_REASSINATURA",
      NEW."HORA_REASSINATURA", NEW."MEDICO_REASSINATURA", NEW."SEGUNDA_ASSINATURA",
      NEW."POSSUI_IMAGENS_CHAVE", NEW."IMAGENS_CHAVES", NEW."IMAGENS_CAPTURADAS",
      NEW."CODIGO_INTERNO", NEW."DIGITADOR", NEW."COMPLEMENTAR", NEW."CATEGORIA",
      COALESCE(NEW.data_referencia, CURRENT_DATE), NEW.arquivo_fonte, NEW.lote_upload, NEW.periodo_referencia,
      NEW.tipo_faturamento, false
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Aplicar o trigger na tabela volumetria_staging
DROP TRIGGER IF EXISTS trigger_staging_processar ON volumetria_staging;
CREATE TRIGGER trigger_staging_processar
  AFTER UPDATE ON volumetria_staging
  FOR EACH ROW
  EXECUTE FUNCTION trigger_staging_to_final();