-- CORREÇÃO CRÍTICA: APLICAÇÃO AUTOMÁTICA DE TODAS AS REGRAS NO TRIGGER
-- =====================================================================

-- 1. CRIAR TRIGGER COMPLETO QUE APLICA TODAS AS REGRAS AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.trigger_volumetria_processamento_final()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  valor_referencia NUMERIC;
  nova_prioridade TEXT;
BEGIN
  -- ===== APLICAR TODAS AS REGRAS AUTOMATICAMENTE =====
  
  -- 1. Normalizar nome do cliente
  IF NEW."EMPRESA" IS NOT NULL THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Normalizar médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Correção de modalidades (v030/v031)
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
  
  -- 4. Aplicar categoria do cadastro de exames
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    -- Se não encontrou, definir como "SC"
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidade automaticamente
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    -- Primeiro tentar do cadastro de exames
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    -- Se não encontrou, mapear por modalidade
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      NEW."ESPECIALIDADE" := CASE NEW."MODALIDADE"
        WHEN 'CT' THEN 'Tomografia'
        WHEN 'MR' THEN 'Ressonância'
        WHEN 'RX' THEN 'Radiologia'
        WHEN 'MG' THEN 'Mamografia'
        WHEN 'US' THEN 'Ultrassonografia'
        WHEN 'DO' THEN 'Densitometria'
        ELSE 'Radiologia'
      END;
    END IF;
  END IF;
  
  -- 6. Aplicar de-para de prioridades
  SELECT dp.prioridade_destino INTO nova_prioridade
  FROM de_para_prioridade dp
  WHERE dp.prioridade_origem = NEW."PRIORIDADE"
    AND dp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  -- 7. Aplicar de-para de valores (somente se valor for zero)
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE vr.estudo_descricao = NEW."ESTUDO_DESCRICAO"
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      NEW."VALORES" := valor_referencia;
    END IF;
  END IF;
  
  -- 8. Aplicar valor onco se categoria for onco
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO', 'Oncologia') AND NEW.arquivo_fonte = 'volumetria_onco_padrao' THEN
    NEW."VALORES" := COALESCE(NEW."VALORES", 1);
  END IF;
  
  -- 9. Garantir data_referencia
  IF NEW.data_referencia IS NULL THEN
    IF NEW."DATA_LAUDO" IS NOT NULL THEN
      NEW.data_referencia := NEW."DATA_LAUDO"::date;
    ELSIF NEW."DATA_REALIZACAO" IS NOT NULL THEN
      NEW.data_referencia := NEW."DATA_REALIZACAO"::date;
    ELSE
      NEW.data_referencia := CURRENT_DATE;
    END IF;
  END IF;
  
  -- 10. Tipificação de faturamento
  IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
    NEW.tipo_faturamento := 'oncologia';
  ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
    NEW.tipo_faturamento := 'urgencia';
  ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
    NEW.tipo_faturamento := 'alta_complexidade';
  ELSE
    NEW.tipo_faturamento := 'padrao';
  END IF;
  
  -- 11. MARCAR PARA QUEBRA SE NECESSÁRIO (v027)
  IF EXISTS (
    SELECT 1 FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
  ) THEN
    NEW.processamento_pendente = true;
  ELSE
    NEW.processamento_pendente = false;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. SUBSTITUIR O TRIGGER EXISTENTE PELO NOVO TRIGGER COMPLETO
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_volumetria_processamento_completo ON volumetria_mobilemed;

CREATE TRIGGER trigger_volumetria_processamento_final
    BEFORE INSERT OR UPDATE ON volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION trigger_volumetria_processamento_final();

-- 3. ATUALIZAR REGISTROS EXISTENTES PARA APLICAR AS REGRAS
UPDATE volumetria_mobilemed SET
  processamento_pendente = CASE 
    WHEN EXISTS (
      SELECT 1 FROM regras_quebra_exames 
      WHERE exame_original = "ESTUDO_DESCRICAO" AND ativo = true
    ) THEN true
    ELSE false
  END
WHERE arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo');

-- 4. EXECUTAR QUEBRAS PENDENTES AUTOMATICAMENTE
SELECT aplicar_quebras_pendentes_corrigido();

-- 5. LOG DA CORREÇÃO
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CORRECAO_TRIGGER_AUTOMATICO', 'v027', 
        jsonb_build_object(
          'operacao', 'correcao_aplicacao_automatica_regras',
          'trigger_substituido', 'trigger_volumetria_processamento_final',
          'regras_aplicadas_automaticamente', ARRAY[
            'normalizacao_cliente',
            'normalizacao_medico', 
            'correcao_modalidades_v030_v031',
            'aplicacao_categorias',
            'aplicacao_especialidades',
            'de_para_prioridades',
            'de_para_valores',
            'valor_onco',
            'tipificacao_faturamento',
            'garantia_data_referencia',
            'marcacao_quebra_v027'
          ],
          'timestamp', now()
        ),
        'system', 'critical');