-- Inserir regras de teste com tipos válidos
INSERT INTO regras_exclusao_faturamento (
  nome,
  descricao,
  criterios,
  ativo,
  prioridade,
  aplicar_incremental,
  aplicar_legado,
  tipo_regra
) VALUES 
(
  'TESTE_EXCLUSAO_EMPRESA',
  'Empresa de teste para validação do sistema',
  '{"empresa": "TESTE_EXCLUSAO_EMPRESA"}',
  true,
  1,
  true,
  true,
  'cliente'
),
(
  'TESTE_EXCLUSAO_VALOR_ZERO',
  'Registros com valor zero devem ser excluídos',
  '{"valor": {"=": 0}}',
  true,
  2,
  true,
  true,
  'valor'
);

-- Atualizar a função aplicar_regras_exclusao_dinamicas para usar os nomes corretos dos campos
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
          IF NEW."VALORES" > (criterio_json->'valor'->>'>')::NUMERIC THEN
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
          'REGRA_EXCLUSAO_' || regra_exclusao.nome,
          regra_exclusao.descricao || ' - Critérios: ' || regra_exclusao.criterios::text,
          COALESCE(NEW.arquivo_fonte, 'unknown'),
          COALESCE(NEW.lote_upload, 'unknown')
        );
        
        RAISE NOTICE 'REGRA EXCLUSÃO %: Registro rejeitado e registrado - % = %', 
          regra_exclusao.nome, 
          regra_exclusao.criterios, 
          regra_exclusao.descricao;
        RETURN NULL;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Configurar trigger na tabela volumetria_mobilemed se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_aplicar_exclusoes_dinamicas' 
      AND event_object_table = 'volumetria_mobilemed'
  ) THEN
    CREATE TRIGGER trigger_aplicar_exclusoes_dinamicas
      BEFORE INSERT ON volumetria_mobilemed
      FOR EACH ROW
      EXECUTE FUNCTION aplicar_regras_exclusao_dinamicas();
  END IF;
END $$;