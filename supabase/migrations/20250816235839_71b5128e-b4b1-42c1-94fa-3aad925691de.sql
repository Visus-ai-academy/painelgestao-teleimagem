-- =====================================================
-- IMPLEMENTAÇÃO DAS REGRAS FALTANTES NO TRIGGER PRINCIPAL
-- =====================================================

-- 1. FUNÇÃO PARA APLICAR QUEBRA DE EXAMES (v027)
CREATE OR REPLACE FUNCTION public.aplicar_quebra_exames()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  regra_quebra RECORD;
  exame_derivado TEXT;
  novo_registro volumetria_mobilemed%ROWTYPE;
BEGIN
  -- Verificar se existe regra de quebra para este exame
  SELECT * INTO regra_quebra
  FROM regras_quebra_exames rqe
  WHERE rqe.exame_original = NEW."ESTUDO_DESCRICAO"
    AND rqe.ativo = true
  LIMIT 1;
  
  IF regra_quebra.id IS NOT NULL THEN
    -- Processar cada exame derivado
    FOR exame_derivado IN 
      SELECT jsonb_array_elements_text(regra_quebra.exames_derivados)
    LOOP
      -- Criar registro para exame derivado
      novo_registro := NEW;
      novo_registro.id := gen_random_uuid();
      novo_registro."ESTUDO_DESCRICAO" := exame_derivado;
      
      -- Aplicar categoria específica se definida
      IF regra_quebra.categoria_quebrada IS NOT NULL THEN
        novo_registro."CATEGORIA" := regra_quebra.categoria_quebrada;
      END IF;
      
      -- Aplicar valor específico se definido
      IF regra_quebra.valor_quebrado IS NOT NULL THEN
        novo_registro."VALORES" := regra_quebra.valor_quebrado;
      END IF;
      
      -- Inserir o registro derivado (sem acionar trigger novamente)
      ALTER TABLE volumetria_mobilemed DISABLE TRIGGER trigger_volumetria_processamento;
      INSERT INTO volumetria_mobilemed SELECT novo_registro.*;
      ALTER TABLE volumetria_mobilemed ENABLE TRIGGER trigger_volumetria_processamento;
    END LOOP;
    
    -- Se há quebra, manter o registro original ou remover conforme configuração
    IF regra_quebra.manter_original = false THEN
      RETURN NULL; -- Remove o registro original
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. FUNÇÃO PARA APLICAR REGRAS DE EXCLUSÃO DINÂMICAS
CREATE OR REPLACE FUNCTION public.aplicar_regras_exclusao_dinamicas()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  regra_exclusao RECORD;
  criterio_json JSONB;
  deve_excluir BOOLEAN := false;
  campo_valor TEXT;
  criterio_valor TEXT;
BEGIN
  -- Buscar todas as regras de exclusão ativas
  FOR regra_exclusao IN 
    SELECT * FROM regras_exclusao_faturamento 
    WHERE ativo = true 
    ORDER BY prioridade ASC
  LOOP
    deve_excluir := false;
    
    -- Processar critérios JSON
    IF regra_exclusao.criterios IS NOT NULL THEN
      criterio_json := regra_exclusao.criterios;
      
      -- Verificar critério por EMPRESA
      IF criterio_json ? 'empresa' THEN
        criterio_valor := criterio_json->>'empresa';
        IF NEW."EMPRESA" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por MODALIDADE
      IF criterio_json ? 'modalidade' THEN
        criterio_valor := criterio_json->>'modalidade';
        IF NEW."MODALIDADE" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por ESPECIALIDADE
      IF criterio_json ? 'especialidade' THEN
        criterio_valor := criterio_json->>'especialidade';
        IF NEW."ESPECIALIDADE" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por CATEGORIA
      IF criterio_json ? 'categoria' THEN
        criterio_valor := criterio_json->>'categoria';
        IF NEW."CATEGORIA" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por MEDICO
      IF criterio_json ? 'medico' THEN
        criterio_valor := criterio_json->>'medico';
        IF NEW."MEDICO" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por PRIORIDADE
      IF criterio_json ? 'prioridade' THEN
        criterio_valor := criterio_json->>'prioridade';
        IF NEW."PRIORIDADE" = criterio_valor THEN
          deve_excluir := true;
        END IF;
      END IF;
      
      -- Verificar critério por VALORES
      IF criterio_json ? 'valor' THEN
        IF criterio_json->'valor' ? '=' THEN
          IF NEW."VALORES" = (criterio_json->'valor'->>'=')::NUMERIC THEN
            deve_excluir := true;
          END IF;
        END IF;
        
        IF criterio_json->'valor' ? '>' THEN
          IF NEW."VALORES" > (criterio_json->'valor'->>'>>')::NUMERIC THEN
            deve_excluir := true;
          END IF;
        END IF;
        
        IF criterio_json->'valor' ? '<' THEN
          IF NEW."VALORES" < (criterio_json->'valor'->>'<')::NUMERIC THEN
            deve_excluir := true;
          END IF;
        END IF;
        
        IF criterio_json->'valor' ? '>=' THEN
          IF NEW."VALORES" >= (criterio_json->'valor'->'>=')::NUMERIC THEN
            deve_excluir := true;
          END IF;
        END IF;
      END IF;
      
      -- Verificar se é aplicável ao tipo de arquivo
      IF deve_excluir THEN
        -- Verificar se deve aplicar para arquivos retroativos
        IF NEW.arquivo_fonte LIKE '%retroativo%' AND regra_exclusao.aplicar_legado = false THEN
          deve_excluir := false;
        END IF;
        
        -- Verificar se deve aplicar para arquivos incrementais
        IF NEW.arquivo_fonte NOT LIKE '%retroativo%' AND regra_exclusao.aplicar_incremental = false THEN
          deve_excluir := false;
        END IF;
      END IF;
      
      -- Se deve excluir, retornar NULL (registro será rejeitado)
      IF deve_excluir THEN
        RAISE NOTICE 'REGRA EXCLUSÃO %: Registro rejeitado por % = %', 
          regra_exclusao.nome_regra, 
          regra_exclusao.criterios, 
          regra_exclusao.motivo_exclusao;
        RETURN NULL;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- 3. FUNÇÃO PARA BUSCAR VALOR ONCO
CREATE OR REPLACE FUNCTION public.aplicar_valor_onco()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  valor_onco NUMERIC;
BEGIN
  -- Aplicar apenas para arquivo onco e valores zerados
  IF NEW.arquivo_fonte = 'volumetria_onco_padrao' AND COALESCE(NEW."VALORES", 0) = 0 THEN
    -- Buscar valor na tabela de valores de referência onco
    SELECT vro.valor INTO valor_onco
    FROM valores_referencia_onco vro
    WHERE vro.estudo_descricao = NEW."ESTUDO_DESCRICAO"
      AND vro.ativo = true
    LIMIT 1;
    
    -- Se não encontrar, buscar na tabela geral de de-para
    IF valor_onco IS NULL THEN
      SELECT vr.valores INTO valor_onco
      FROM valores_referencia_de_para vr
      WHERE vr.estudo_descricao = NEW."ESTUDO_DESCRICAO"
        AND vr.ativo = true
      LIMIT 1;
    END IF;
    
    IF valor_onco IS NOT NULL THEN
      NEW."VALORES" := valor_onco;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. FUNÇÃO PARA APLICAR ESPECIALIDADES AUTOMÁTICAS
CREATE OR REPLACE FUNCTION public.aplicar_especialidade_automatica()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Aplicar especialidade baseada no cadastro de exames se não há especialidade
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    -- Se não encontrou no cadastro, definir especialidade baseada na modalidade
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      CASE NEW."MODALIDADE"
        WHEN 'CT' THEN NEW."ESPECIALIDADE" := 'TOMOGRAFIA';
        WHEN 'MR' THEN NEW."ESPECIALIDADE" := 'RESSONANCIA';
        WHEN 'RX' THEN NEW."ESPECIALIDADE" := 'RADIOLOGIA';
        WHEN 'US' THEN NEW."ESPECIALIDADE" := 'ULTRASSOM';
        WHEN 'MG' THEN NEW."ESPECIALIDADE" := 'MAMOGRAFIA';
        WHEN 'DO' THEN NEW."ESPECIALIDADE" := 'DENSITOMETRIA';
        ELSE NEW."ESPECIALIDADE" := 'GERAL';
      END CASE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. ATUALIZAR O TRIGGER PRINCIPAL PARA INCLUIR TODAS AS REGRAS
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

CREATE OR REPLACE FUNCTION public.volumetria_processamento_completo()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- 1. Aplicar regras de exclusão dinâmicas PRIMEIRO (pode rejeitar o registro)
  NEW := aplicar_regras_exclusao_dinamicas(NEW);
  IF NEW IS NULL THEN
    RETURN NULL; -- Registro rejeitado pelas regras de exclusão
  END IF;
  
  -- 2. Aplicar regras de exclusão por período (v002, v003, v031)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    NEW := aplicar_regras_retroativas(NEW);
    IF NEW IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  ELSE
    NEW := aplicar_regras_periodo_atual(NEW);
    IF NEW IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  END IF;
  
  -- 3. Normalizar nome do cliente
  NEW := normalizar_cliente_trigger(NEW);
  
  -- 4. Aplicar correções de modalidade (v030, v031)
  NEW := aplicar_correcao_modalidades(NEW);
  
  -- 5. Aplicar especialidades automáticas
  NEW := aplicar_especialidade_automatica(NEW);
  
  -- 6. Aplicar categorias
  NEW := aplicar_categorias_trigger(NEW);
  
  -- 7. Aplicar De-Para de prioridades
  NEW := aplicar_prioridades_de_para(NEW);
  
  -- 8. Aplicar De-Para de valores (geral)
  NEW := aplicar_de_para_trigger(NEW);
  
  -- 9. Aplicar valores específicos para onco
  NEW := aplicar_valor_onco(NEW);
  
  -- 10. Aplicar tipificação de faturamento
  NEW := aplicar_tipificacao_faturamento(NEW);
  
  -- 11. Aplicar quebra de exames (ÚLTIMO - pode gerar registros adicionais)
  NEW := aplicar_quebra_exames(NEW);
  
  -- Retornar o registro processado
  RETURN NEW;
END;
$function$;

-- 6. CRIAR O TRIGGER ATUALIZADO
CREATE TRIGGER trigger_volumetria_processamento
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION volumetria_processamento_completo();

-- 7. FUNÇÃO PARA OBTER ESTATÍSTICAS DAS REGRAS APLICADAS
CREATE OR REPLACE FUNCTION public.get_regras_aplicadas_detalhadas()
RETURNS TABLE(
  regra text, 
  total_aplicacoes bigint, 
  ultima_aplicacao timestamp with time zone,
  registros_rejeitados bigint,
  registros_processados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    'Regras de Exclusão Dinâmicas' as regra,
    COUNT(*) as total_aplicacoes,
    MAX(al.timestamp) as ultima_aplicacao,
    COUNT(*) FILTER (WHERE al.operation LIKE 'REGRA_%REJEITADO') as registros_rejeitados,
    COUNT(*) FILTER (WHERE al.operation LIKE 'REGRA_%PROCESSADO') as registros_processados
  FROM audit_logs al 
  WHERE al.table_name = 'volumetria_mobilemed'
    AND al.operation LIKE 'REGRA_%'
  
  UNION ALL
  
  SELECT 
    operation as regra,
    COUNT(*) as total_aplicacoes,
    MAX(timestamp) as ultima_aplicacao,
    0::bigint as registros_rejeitados,
    COUNT(*) as registros_processados
  FROM audit_logs 
  WHERE table_name = 'volumetria_mobilemed'
    AND operation IN ('QUEBRA_EXAMES', 'VALOR_ONCO', 'ESPECIALIDADE_AUTO')
  GROUP BY operation
  ORDER BY total_aplicacoes DESC;
END;
$function$;

-- 8. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON FUNCTION public.aplicar_quebra_exames() IS 'v027: Aplica regras de quebra de exames compostos em individuais';
COMMENT ON FUNCTION public.aplicar_regras_exclusao_dinamicas() IS 'Aplica regras de exclusão configuradas dinamicamente na tabela regras_exclusao_faturamento';
COMMENT ON FUNCTION public.aplicar_valor_onco() IS 'Busca valores específicos para exames de oncologia';
COMMENT ON FUNCTION public.aplicar_especialidade_automatica() IS 'Define especialidade baseada no cadastro de exames ou modalidade';
COMMENT ON FUNCTION public.volumetria_processamento_completo() IS 'Trigger principal que aplica TODAS as regras de negócio na volumetria';

-- 9. LOG DA MIGRAÇÃO
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema', 'MIGRATION', 'regras_completas', 
        jsonb_build_object(
          'timestamp', now(),
          'operacao', 'implementacao_regras_faltantes',
          'regras_implementadas', ARRAY[
            'v027_quebra_exames',
            'regras_exclusao_dinamicas', 
            'valor_onco',
            'especialidade_automatica',
            'trigger_principal_completo'
          ]
        ),
        'system', 'info');