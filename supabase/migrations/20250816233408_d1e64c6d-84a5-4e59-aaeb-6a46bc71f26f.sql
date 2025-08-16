-- =====================================
-- SISTEMA COMPLETO DE DATABASE FUNCTIONS/TRIGGERS
-- PARA PROCESSAMENTO AUTOMÁTICO DE VOLUMETRIA
-- =====================================

-- Desabilitar triggers durante a migração para evitar loops
SET session_replication_role = replica;

-- =====================================
-- 1. FUNCTIONS PARA APLICAÇÃO DE REGRAS
-- =====================================

-- Função para aplicar regras v002/v003 (exclusões por período para retroativos)
CREATE OR REPLACE FUNCTION aplicar_regras_retroativas()
RETURNS TRIGGER AS $$
DECLARE
  periodo_ano INTEGER;
  periodo_mes INTEGER;
  data_limite_realizacao DATE;
  inicio_faturamento DATE;
  fim_faturamento DATE;
BEGIN
  -- Só aplicar para arquivos retroativos
  IF NEW.arquivo_fonte NOT LIKE '%retroativo%' THEN
    RETURN NEW;
  END IF;
  
  -- Extrair período da data_referencia
  periodo_ano := EXTRACT(YEAR FROM NEW.data_referencia);
  periodo_mes := EXTRACT(MONTH FROM NEW.data_referencia);
  
  -- Calcular datas baseadas no período
  data_limite_realizacao := DATE(periodo_ano, periodo_mes, 1); -- 01 do mês
  inicio_faturamento := DATE(periodo_ano, periodo_mes, 8);     -- 08 do mês
  fim_faturamento := DATE(periodo_ano, periodo_mes + 1, 7);   -- 07 do mês seguinte
  
  -- REGRA v003: Rejeitar se DATA_REALIZACAO >= 01 do mês especificado
  IF NEW."DATA_REALIZACAO" >= data_limite_realizacao THEN
    RAISE NOTICE 'REGRA v003: Registro rejeitado por DATA_REALIZACAO >= %', data_limite_realizacao;
    RETURN NULL; -- Não inserir o registro
  END IF;
  
  -- REGRA v002: Rejeitar se DATA_LAUDO fora do período de faturamento
  IF NEW."DATA_LAUDO" < inicio_faturamento OR NEW."DATA_LAUDO" > fim_faturamento THEN
    RAISE NOTICE 'REGRA v002: Registro rejeitado por DATA_LAUDO fora do período % a %', inicio_faturamento, fim_faturamento;
    RETURN NULL; -- Não inserir o registro
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar regras v031 (filtro período atual para não-retroativos)
CREATE OR REPLACE FUNCTION aplicar_regras_periodo_atual()
RETURNS TRIGGER AS $$
DECLARE
  periodo_ano INTEGER;
  periodo_mes INTEGER;
  realizacao_inicio_mes DATE;
  realizacao_fim_mes DATE;
  laudo_inicio_janela DATE;
  laudo_fim_janela DATE;
BEGIN
  -- Só aplicar para arquivos NÃO retroativos
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    RETURN NEW;
  END IF;
  
  -- Extrair período da data_referencia
  periodo_ano := EXTRACT(YEAR FROM NEW.data_referencia);
  periodo_mes := EXTRACT(MONTH FROM NEW.data_referencia);
  
  -- Calcular datas do período
  realizacao_inicio_mes := DATE(periodo_ano, periodo_mes, 1);     -- 01 do mês
  realizacao_fim_mes := (DATE(periodo_ano, periodo_mes + 1, 1) - INTERVAL '1 day')::date; -- último dia do mês
  laudo_inicio_janela := DATE(periodo_ano, periodo_mes, 1);       -- 01 do mês
  laudo_fim_janela := DATE(periodo_ano, periodo_mes + 1, 7);     -- 07 do mês seguinte
  
  -- REGRA v031: Validar período de realização
  IF NEW."DATA_REALIZACAO" < realizacao_inicio_mes OR NEW."DATA_REALIZACAO" > realizacao_fim_mes THEN
    RAISE NOTICE 'REGRA v031: Registro rejeitado por DATA_REALIZACAO fora do período % a %', realizacao_inicio_mes, realizacao_fim_mes;
    RETURN NULL;
  END IF;
  
  -- REGRA v031: Validar janela de laudo
  IF NEW."DATA_LAUDO" < laudo_inicio_janela OR NEW."DATA_LAUDO" > laudo_fim_janela THEN
    RAISE NOTICE 'REGRA v031: Registro rejeitado por DATA_LAUDO fora da janela % a %', laudo_inicio_janela, laudo_fim_janela;
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar correção de modalidades (v030)
CREATE OR REPLACE FUNCTION aplicar_correcao_modalidades()
RETURNS TRIGGER AS $$
BEGIN
  -- REGRA v030: Correção CR/DX para RX ou MG baseado no ESTUDO_DESCRICAO
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
      NEW."MODALIDADE" := 'MG';
      RAISE NOTICE 'REGRA v030: Modalidade corrigida de % para MG (MAMOGRAFIA)', OLD."MODALIDADE";
    ELSE
      NEW."MODALIDADE" := 'RX';
      RAISE NOTICE 'REGRA v030: Modalidade corrigida de % para RX', OLD."MODALIDADE";
    END IF;
  END IF;
  
  -- REGRA v031: Correção OT para DO
  IF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
    RAISE NOTICE 'REGRA v031: Modalidade corrigida de OT para DO';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar De-Para automático
CREATE OR REPLACE FUNCTION aplicar_de_para_trigger()
RETURNS TRIGGER AS $$
DECLARE
  valor_referencia NUMERIC;
BEGIN
  -- Aplicar de-para somente se VALORES for zero ou nulo
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE vr.estudo_descricao = NEW."ESTUDO_DESCRICAO"
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      NEW."VALORES" := valor_referencia;
      RAISE NOTICE 'DE-PARA: Valor % aplicado para estudo %', valor_referencia, NEW."ESTUDO_DESCRICAO";
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar categorias automaticamente
CREATE OR REPLACE FUNCTION aplicar_categorias_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar categoria do cadastro de exames
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    -- Se não encontrou no cadastro, tentar nas regras de quebra
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      SELECT rqe.categoria_quebrada INTO NEW."CATEGORIA"
      FROM regras_quebra_exames rqe
      WHERE rqe.exame_quebrado = NEW."ESTUDO_DESCRICAO"
        AND rqe.ativo = true
        AND rqe.categoria_quebrada IS NOT NULL
        AND rqe.categoria_quebrada != ''
      LIMIT 1;
    END IF;
    
    -- Se ainda não tem categoria, definir como "SC"
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- Categoria especial para arquivo onco
  IF NEW.arquivo_fonte = 'volumetria_onco_padrao' THEN
    NEW."CATEGORIA" := 'Onco';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar prioridades De-Para
CREATE OR REPLACE FUNCTION aplicar_prioridades_de_para()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar mapeamento de prioridades
  SELECT dp.prioridade_destino INTO NEW."PRIORIDADE"
  FROM de_para_prioridade dp
  WHERE dp.prioridade_origem = NEW."PRIORIDADE"
    AND dp.ativo = true
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para normalizar nomes de clientes
CREATE OR REPLACE FUNCTION normalizar_cliente_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para aplicar tipificação de faturamento
CREATE OR REPLACE FUNCTION aplicar_tipificacao_faturamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Definir tipo_faturamento baseado nas regras de negócio
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
    NEW.tipo_faturamento := 'urgencia';
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. TRIGGERS PARA APLICAÇÃO AUTOMÁTICA
-- =====================================

-- Trigger principal que aplica todas as regras na sequência correta
CREATE OR REPLACE FUNCTION volumetria_processamento_completo()
RETURNS TRIGGER AS $$
DECLARE
  temp_record RECORD;
BEGIN
  -- Inicializar com o novo registro
  temp_record := NEW;
  
  -- 1. Aplicar regras de exclusão por período (v002, v003, v031)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    temp_record := aplicar_regras_retroativas(NEW);
    IF temp_record IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  ELSE
    temp_record := aplicar_regras_periodo_atual(NEW);
    IF temp_record IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  END IF;
  
  -- 2. Normalizar nome do cliente
  temp_record := normalizar_cliente_trigger(temp_record);
  
  -- 3. Aplicar correções de modalidade (v030, v031)
  temp_record := aplicar_correcao_modalidades(temp_record);
  
  -- 4. Aplicar categorias
  temp_record := aplicar_categorias_trigger(temp_record);
  
  -- 5. Aplicar De-Para de prioridades
  temp_record := aplicar_prioridades_de_para(temp_record);
  
  -- 6. Aplicar De-Para de valores
  temp_record := aplicar_de_para_trigger(temp_record);
  
  -- 7. Aplicar tipificação de faturamento
  temp_record := aplicar_tipificacao_faturamento(temp_record);
  
  -- Retornar o registro processado
  RETURN temp_record;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger principal
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;
CREATE TRIGGER trigger_volumetria_processamento
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION volumetria_processamento_completo();

-- =====================================
-- 3. FUNCTION PARA REPROCESSAR DADOS EXISTENTES
-- =====================================

CREATE OR REPLACE FUNCTION reprocessar_volumetria_existente(arquivo_fonte_param TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  total_processados INTEGER := 0;
  total_rejeitados INTEGER := 0;
  registro RECORD;
  novo_registro volumetria_mobilemed%ROWTYPE;
  resultado JSONB;
BEGIN
  -- Desabilitar o trigger durante o reprocessamento para evitar loop
  ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_volumetria_processamento;
  
  -- Criar tabela temporária para backup
  CREATE TEMP TABLE volumetria_backup AS 
  SELECT * FROM volumetria_mobilemed 
  WHERE (arquivo_fonte_param IS NULL OR arquivo_fonte = arquivo_fonte_param);
  
  -- Deletar registros originais
  DELETE FROM volumetria_mobilemed 
  WHERE (arquivo_fonte_param IS NULL OR arquivo_fonte = arquivo_fonte_param);
  
  -- Reabilitar o trigger
  ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_volumetria_processamento;
  
  -- Reprocessar cada registro
  FOR registro IN SELECT * FROM volumetria_backup LOOP
    BEGIN
      -- Aplicar processamento completo
      novo_registro := volumetria_processamento_completo(registro);
      
      IF novo_registro IS NOT NULL THEN
        -- Inserir registro processado (sem trigger para evitar loop duplo)
        ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_volumetria_processamento;
        INSERT INTO volumetria_mobilemed SELECT novo_registro.*;
        ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_volumetria_processamento;
        total_processados := total_processados + 1;
      ELSE
        total_rejeitados := total_rejeitados + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      total_rejeitados := total_rejeitados + 1;
      RAISE NOTICE 'Erro ao processar registro ID %: %', registro.id, SQLERRM;
    END;
  END LOOP;
  
  -- Limpar tabela temporária
  DROP TABLE volumetria_backup;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'total_processados', total_processados,
    'total_rejeitados', total_rejeitados,
    'arquivo_fonte', COALESCE(arquivo_fonte_param, 'TODOS'),
    'data_processamento', now()
  );
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'REPROCESSAMENTO_COMPLETO', 
          COALESCE(arquivo_fonte_param, 'TODOS'), resultado,
          'system', 'info');
  
  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. FUNCTIONS DE MONITORAMENTO
-- =====================================

CREATE OR REPLACE FUNCTION get_regras_aplicadas_stats()
RETURNS TABLE(
  regra TEXT,
  total_aplicacoes BIGINT,
  ultima_aplicacao TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    operation as regra,
    COUNT(*) as total_aplicacoes,
    MAX(timestamp) as ultima_aplicacao
  FROM audit_logs 
  WHERE table_name = 'volumetria_mobilemed'
    AND operation LIKE 'REGRA_%'
  GROUP BY operation
  ORDER BY total_aplicacoes DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. ATUALIZAR FUNCTIONS EXISTENTES
-- =====================================

-- Modificar função de aplicar De-Para para ser compatível com triggers
CREATE OR REPLACE FUNCTION aplicar_de_para_automatico(arquivo_fonte_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Esta função agora é redundante pois o trigger faz automaticamente
  -- Mas mantemos para compatibilidade com edge functions existentes
  
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE vm."ESTUDO_DESCRICAO" = vr.estudo_descricao
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte = arquivo_fonte_param;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'arquivo_fonte', arquivo_fonte_param,
    'data_processamento', now(),
    'observacao', 'Aplicado via trigger automático'
  );
  
  RETURN resultado;
END;
$function$;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- =====================================
-- 6. LOGS E AUDITORIA
-- =====================================

INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'SISTEMA_TRIGGERS_INSTALADO', 'migration', 
        jsonb_build_object(
          'triggers_criados', ARRAY[
            'trigger_volumetria_processamento',
            'aplicar_regras_retroativas',
            'aplicar_regras_periodo_atual', 
            'aplicar_correcao_modalidades',
            'aplicar_de_para_trigger',
            'aplicar_categorias_trigger',
            'aplicar_prioridades_de_para',
            'normalizar_cliente_trigger',
            'aplicar_tipificacao_faturamento'
          ],
          'observacao', 'Sistema completo de triggers para processamento automático de volumetria instalado'
        ),
        'system', 'info');