-- Ativar trigger de quebra de exames no processamento
-- Primeiro verificar se existe trigger principal de processamento
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- Criar trigger principal que executa todas as regras incluindo quebra
CREATE OR REPLACE FUNCTION trigger_volumetria_processamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar normalização de médico
  NEW := trigger_normalizar_medico(NEW);
  
  -- Aplicar limpeza de nome do cliente
  NEW := trigger_limpar_nome_cliente(NEW);
  
  -- Aplicar correções de modalidade
  NEW := aplicar_correcao_modalidades(NEW);
  
  -- Aplicar regras de período (retroativo vs atual)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    NEW := aplicar_regras_retroativas(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  ELSE
    NEW := aplicar_regras_periodo_atual(NEW);
    IF NEW IS NULL THEN RETURN NULL; END IF;
  END IF;
  
  -- Aplicar regras de exclusão dinâmicas
  NEW := aplicar_regras_exclusao_dinamicas(NEW);
  IF NEW IS NULL THEN RETURN NULL; END IF;
  
  -- Aplicar categorias
  NEW := aplicar_categorias_trigger(NEW);
  
  -- Aplicar de-para de prioridades
  NEW := aplicar_prioridades_de_para(NEW);
  
  -- Aplicar de-para de valores
  NEW := aplicar_de_para_trigger(NEW);
  
  -- Aplicar valor onco
  NEW := aplicar_valor_onco(NEW);
  
  -- Aplicar tipificação de faturamento
  NEW := aplicar_tipificacao_faturamento(NEW);
  
  -- IMPORTANTE: Aplicar quebra de exames por último
  -- Isso permitirá que a quebra seja aplicada após todas as outras regras
  PERFORM aplicar_quebra_exames_processamento(NEW);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função específica para quebra que não retorna o registro original
CREATE OR REPLACE FUNCTION aplicar_quebra_exames_processamento(registro_original volumetria_mobilemed)
RETURNS VOID AS $$
DECLARE
  regra_quebra RECORD;
  exame_derivado TEXT;
  novo_registro volumetria_mobilemed%ROWTYPE;
  total_derivados INTEGER;
BEGIN
  -- Verificar se existe regra de quebra para este exame
  SELECT * INTO regra_quebra
  FROM regras_quebra_exames rqe
  WHERE rqe.exame_original = registro_original."ESTUDO_DESCRICAO"
    AND rqe.ativo = true
  LIMIT 1;
  
  IF regra_quebra.id IS NOT NULL THEN
    -- Contar quantos exames derivados existem
    total_derivados := jsonb_array_length(regra_quebra.exames_derivados);
    
    -- Processar cada exame derivado
    FOR i IN 0..(total_derivados - 1) LOOP
      exame_derivado := regra_quebra.exames_derivados->>i;
      
      -- Criar registro para exame derivado
      novo_registro := registro_original;
      novo_registro.id := gen_random_uuid();
      novo_registro."ESTUDO_DESCRICAO" := exame_derivado;
      
      -- Aplicar categoria específica se definida
      IF regra_quebra.categoria_quebrada IS NOT NULL THEN
        novo_registro."CATEGORIA" := regra_quebra.categoria_quebrada;
      END IF;
      
      -- Dividir valor pelo número de exames derivados se valor_quebrado não especificado
      IF regra_quebra.valor_quebrado IS NOT NULL THEN
        novo_registro."VALORES" := regra_quebra.valor_quebrado;
      ELSE
        novo_registro."VALORES" := ROUND((registro_original."VALORES" / total_derivados)::numeric, 2);
      END IF;
      
      -- Inserir o registro derivado (desabilitar trigger para evitar loop)
      SET session_replication_role = replica;
      INSERT INTO volumetria_mobilemed SELECT novo_registro.*;
      SET session_replication_role = DEFAULT;
    END LOOP;
    
    -- Se não deve manter original, deletar o registro
    IF regra_quebra.manter_original = false THEN
      SET session_replication_role = replica;
      DELETE FROM volumetria_mobilemed WHERE id = registro_original.id;
      SET session_replication_role = DEFAULT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Ativar o trigger principal
CREATE TRIGGER trigger_volumetria_processamento
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_volumetria_processamento();