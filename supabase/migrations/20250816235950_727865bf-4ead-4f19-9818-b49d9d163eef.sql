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