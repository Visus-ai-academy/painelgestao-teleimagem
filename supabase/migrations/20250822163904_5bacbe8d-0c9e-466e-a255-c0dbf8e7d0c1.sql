-- Primeiro fazer DROP das funções existentes que têm parâmetros diferentes
DROP FUNCTION IF EXISTS public.aplicar_regras_periodo_atual(volumetria_mobilemed);
DROP FUNCTION IF EXISTS public.aplicar_regras_retroativas(volumetria_mobilemed);

-- 1. Criar uma função para log consistente de rejeições
CREATE OR REPLACE FUNCTION public.log_rejeicao_registro(
  p_dados_originais jsonb,
  p_motivo_rejeicao text,
  p_detalhes_erro text DEFAULT NULL,
  p_arquivo_fonte text DEFAULT 'unknown',
  p_lote_upload text DEFAULT 'unknown'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO registros_rejeitados_processamento (
    arquivo_fonte,
    lote_upload,
    linha_original,
    dados_originais,
    motivo_rejeicao,
    detalhes_erro,
    created_at
  ) VALUES (
    p_arquivo_fonte,
    p_lote_upload,
    1, -- Linha original não disponível no trigger
    p_dados_originais,
    p_motivo_rejeicao,
    COALESCE(p_detalhes_erro, 'Registro rejeitado durante processamento'),
    now()
  );
END;
$$;

-- 2. Atualizar a função aplicar_regras_exclusao_dinamicas para usar a nova função de log
CREATE OR REPLACE FUNCTION public.aplicar_regras_exclusao_dinamicas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      
      -- Se deve excluir, registrar e retornar NULL
      IF deve_excluir THEN
        -- Usar a nova função consistente de log
        PERFORM log_rejeicao_registro(
          row_to_json(NEW)::jsonb,
          'REGRA_EXCLUSAO_' || regra_exclusao.nome_regra,
          regra_exclusao.motivo_exclusao || ' - Critérios: ' || regra_exclusao.criterios::text,
          COALESCE(NEW.arquivo_fonte, 'unknown'),
          COALESCE(NEW.lote_upload, 'unknown')
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
$$;