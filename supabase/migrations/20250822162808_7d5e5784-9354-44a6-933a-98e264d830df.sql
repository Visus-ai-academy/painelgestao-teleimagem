-- Corrigir rastreamento de exclusões por regras dinâmicas
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
      
      -- CORREÇÃO: Registrar a exclusão antes de retornar NULL
      IF deve_excluir THEN
        -- Registrar na tabela de rejeições
        INSERT INTO registros_rejeitados_processamento (
          arquivo_fonte,
          lote_upload,
          linha_original,
          dados_originais,
          motivo_rejeicao,
          detalhes_erro,
          created_at
        ) VALUES (
          COALESCE(NEW.arquivo_fonte, 'unknown'),
          COALESCE(NEW.lote_upload, 'unknown'),
          1, -- Linha original não disponível no trigger
          row_to_json(NEW),
          'REGRA_EXCLUSAO_' || regra_exclusao.nome_regra,
          regra_exclusao.motivo_exclusao || ' - Critérios: ' || regra_exclusao.criterios::text,
          now()
        );
        
        RAISE NOTICE 'REGRA EXCLUSÃO %: Registro rejeitado e registrado - % = %', 
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

-- Também criar função para registrar exclusões por regras de período (retroativo/atual)
CREATE OR REPLACE FUNCTION public.aplicar_regras_periodo_atual(registro_input volumetria_mobilemed)
 RETURNS volumetria_mobilemed
 LANGUAGE plpgsql
AS $function$
DECLARE
  periodo_ano INTEGER;
  periodo_mes INTEGER;
  realizacao_inicio_mes DATE;
  realizacao_fim_mes DATE;
  laudo_inicio_janela DATE;
  laudo_fim_janela DATE;
BEGIN
  -- Só aplicar para arquivos NÃO retroativos
  IF registro_input.arquivo_fonte LIKE '%retroativo%' THEN
    RETURN registro_input;
  END IF;
  
  -- Extrair período da data_referencia
  periodo_ano := EXTRACT(YEAR FROM registro_input.data_referencia);
  periodo_mes := EXTRACT(MONTH FROM registro_input.data_referencia);
  
  -- Calcular datas do período
  realizacao_inicio_mes := DATE(periodo_ano, periodo_mes, 1);     -- 01 do mês
  realizacao_fim_mes := (DATE(periodo_ano, periodo_mes + 1, 1) - INTERVAL '1 day')::date; -- último dia do mês
  laudo_inicio_janela := DATE(periodo_ano, periodo_mes, 1);       -- 01 do mês
  laudo_fim_janela := DATE(periodo_ano, periodo_mes + 1, 7);     -- 07 do mês seguinte
  
  -- REGRA v031: Validar período de realização
  IF registro_input."DATA_REALIZACAO" < realizacao_inicio_mes OR registro_input."DATA_REALIZACAO" > realizacao_fim_mes THEN
    -- Registrar exclusão
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      COALESCE(registro_input.arquivo_fonte, 'unknown'),
      COALESCE(registro_input.lote_upload, 'unknown'),
      1,
      row_to_json(registro_input),
      'REGRA_v031_DATA_REALIZACAO',
      'Data de realização fora do período válido (' || realizacao_inicio_mes || ' a ' || realizacao_fim_mes || ')',
      now()
    );
    
    RAISE NOTICE 'REGRA v031: Registro rejeitado por DATA_REALIZACAO fora do período % a %', realizacao_inicio_mes, realizacao_fim_mes;
    RETURN NULL;
  END IF;
  
  -- REGRA v031: Validar janela de laudo
  IF registro_input."DATA_LAUDO" < laudo_inicio_janela OR registro_input."DATA_LAUDO" > laudo_fim_janela THEN
    -- Registrar exclusão
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      COALESCE(registro_input.arquivo_fonte, 'unknown'),
      COALESCE(registro_input.lote_upload, 'unknown'),
      1,
      row_to_json(registro_input),
      'REGRA_v031_DATA_LAUDO',
      'Data de laudo fora da janela válida (' || laudo_inicio_janela || ' a ' || laudo_fim_janela || ')',
      now()
    );
    
    RAISE NOTICE 'REGRA v031: Registro rejeitado por DATA_LAUDO fora da janela % a %', laudo_inicio_janela, laudo_fim_janela;
    RETURN NULL;
  END IF;
  
  RETURN registro_input;
END;
$function$;

-- Criar função para registrar exclusões por regras retroativas
CREATE OR REPLACE FUNCTION public.aplicar_regras_retroativas(registro_input volumetria_mobilemed)
 RETURNS volumetria_mobilemed
 LANGUAGE plpgsql
AS $function$
DECLARE
  periodo_ano INTEGER;
  periodo_mes INTEGER;
  data_limite_realizacao DATE;
  inicio_faturamento DATE;
  fim_faturamento DATE;
BEGIN
  -- Só aplicar para arquivos retroativos
  IF registro_input.arquivo_fonte NOT LIKE '%retroativo%' THEN
    RETURN registro_input;
  END IF;
  
  -- Extrair período da data_referencia
  periodo_ano := EXTRACT(YEAR FROM registro_input.data_referencia);
  periodo_mes := EXTRACT(MONTH FROM registro_input.data_referencia);
  
  -- Calcular datas baseadas no período
  data_limite_realizacao := DATE(periodo_ano, periodo_mes, 1); -- 01 do mês
  inicio_faturamento := DATE(periodo_ano, periodo_mes, 8);     -- 08 do mês
  fim_faturamento := DATE(periodo_ano, periodo_mes + 1, 7);   -- 07 do mês seguinte
  
  -- REGRA v003: Rejeitar se DATA_REALIZACAO >= 01 do mês especificado
  IF registro_input."DATA_REALIZACAO" >= data_limite_realizacao THEN
    -- Registrar exclusão
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      COALESCE(registro_input.arquivo_fonte, 'unknown'),
      COALESCE(registro_input.lote_upload, 'unknown'),
      1,
      row_to_json(registro_input),
      'REGRA_v003_DATA_REALIZACAO',
      'Data de realização deve ser anterior a ' || data_limite_realizacao,
      now()
    );
    
    RAISE NOTICE 'REGRA v003: Registro rejeitado por DATA_REALIZACAO >= %', data_limite_realizacao;
    RETURN NULL;
  END IF;
  
  -- REGRA v002: Rejeitar se DATA_LAUDO fora do período de faturamento
  IF registro_input."DATA_LAUDO" < inicio_faturamento OR registro_input."DATA_LAUDO" > fim_faturamento THEN
    -- Registrar exclusão
    INSERT INTO registros_rejeitados_processamento (
      arquivo_fonte, lote_upload, linha_original, dados_originais, 
      motivo_rejeicao, detalhes_erro, created_at
    ) VALUES (
      COALESCE(registro_input.arquivo_fonte, 'unknown'),
      COALESCE(registro_input.lote_upload, 'unknown'),
      1,
      row_to_json(registro_input),
      'REGRA_v002_DATA_LAUDO',
      'Data de laudo fora do período de faturamento (' || inicio_faturamento || ' a ' || fim_faturamento || ')',
      now()
    );
    
    RAISE NOTICE 'REGRA v002: Registro rejeitado por DATA_LAUDO fora do período % a %', inicio_faturamento, fim_faturamento;
    RETURN NULL;
  END IF;
  
  RETURN registro_input;
END;
$function$;