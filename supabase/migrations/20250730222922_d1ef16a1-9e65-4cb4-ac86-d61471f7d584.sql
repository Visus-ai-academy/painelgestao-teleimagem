-- Remover todas as duplicatas restantes, mantendo apenas o registro mais recente
-- Para registros com ACCESSION_NUMBER não nulo
DELETE FROM volumetria_mobilemed v1
WHERE EXISTS (
  SELECT 1 FROM volumetria_mobilemed v2
  WHERE v2."ACCESSION_NUMBER" = v1."ACCESSION_NUMBER"
    AND v2."ACCESSION_NUMBER" IS NOT NULL
    AND v2.id > v1.id
);

-- Para registros com ACCESSION_NUMBER nulo, remover duplicatas baseado em outros campos
DELETE FROM volumetria_mobilemed v1
WHERE v1."ACCESSION_NUMBER" IS NULL
  AND EXISTS (
    SELECT 1 FROM volumetria_mobilemed v2
    WHERE v2."ACCESSION_NUMBER" IS NULL
      AND v2."EMPRESA" = v1."EMPRESA"
      AND v2."NOME_PACIENTE" = v1."NOME_PACIENTE"
      AND v2."ESTUDO_DESCRICAO" = v1."ESTUDO_DESCRICAO"
      AND COALESCE(v2."DATA_REALIZACAO", v2."DATA_LAUDO") = COALESCE(v1."DATA_REALIZACAO", v1."DATA_LAUDO")
      AND v2.id > v1.id
  );

-- Agora vamos contar os registros reais após limpeza total
-- e atualizar processamento_uploads com os números corretos

-- Contar registros reais por tipo de arquivo
DO $$
DECLARE
    volumetria_padrao_count INTEGER;
    volumetria_padrao_retroativo_count INTEGER;
    volumetria_fora_padrao_count INTEGER;
    volumetria_fora_padrao_retroativo_count INTEGER;
    volumetria_padrao_zeros INTEGER;
    volumetria_fora_padrao_zeros INTEGER;
    volumetria_fora_padrao_retroativo_zeros INTEGER;
BEGIN
    -- Contar registros por tipo
    SELECT COUNT(*) INTO volumetria_padrao_count 
    FROM volumetria_mobilemed WHERE arquivo_fonte = 'volumetria_padrao';
    
    SELECT COUNT(*) INTO volumetria_padrao_retroativo_count 
    FROM volumetria_mobilemed WHERE arquivo_fonte = 'volumetria_padrao_retroativo';
    
    SELECT COUNT(*) INTO volumetria_fora_padrao_count 
    FROM volumetria_mobilemed WHERE arquivo_fonte = 'volumetria_fora_padrao';
    
    SELECT COUNT(*) INTO volumetria_fora_padrao_retroativo_count 
    FROM volumetria_mobilemed WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo';
    
    -- Contar zeros por tipo
    SELECT COUNT(*) INTO volumetria_padrao_zeros 
    FROM volumetria_mobilemed 
    WHERE arquivo_fonte = 'volumetria_padrao' AND ("VALORES" = 0 OR "VALORES" IS NULL);
    
    SELECT COUNT(*) INTO volumetria_fora_padrao_zeros 
    FROM volumetria_mobilemed 
    WHERE arquivo_fonte = 'volumetria_fora_padrao' AND ("VALORES" = 0 OR "VALORES" IS NULL);
    
    SELECT COUNT(*) INTO volumetria_fora_padrao_retroativo_zeros 
    FROM volumetria_mobilemed 
    WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo' AND ("VALORES" = 0 OR "VALORES" IS NULL);
    
    -- Atualizar processamento_uploads com números reais
    UPDATE processamento_uploads SET
      registros_processados = volumetria_padrao_count,
      registros_inseridos = volumetria_padrao_count - volumetria_padrao_zeros,
      registros_atualizados = 0,
      registros_erro = volumetria_padrao_zeros
    WHERE tipo_arquivo = 'volumetria_padrao';

    UPDATE processamento_uploads SET
      registros_processados = volumetria_padrao_retroativo_count,
      registros_inseridos = volumetria_padrao_retroativo_count,
      registros_atualizados = 0,
      registros_erro = 0
    WHERE tipo_arquivo = 'volumetria_padrao_retroativo';

    UPDATE processamento_uploads SET
      registros_processados = volumetria_fora_padrao_count,
      registros_inseridos = volumetria_fora_padrao_count - volumetria_fora_padrao_zeros,
      registros_atualizados = 0,
      registros_erro = volumetria_fora_padrao_zeros
    WHERE tipo_arquivo = 'volumetria_fora_padrao';

    UPDATE processamento_uploads SET
      registros_processados = volumetria_fora_padrao_retroativo_count,
      registros_inseridos = volumetria_fora_padrao_retroativo_count - volumetria_fora_padrao_retroativo_zeros,
      registros_atualizados = 0,
      registros_erro = volumetria_fora_padrao_retroativo_zeros
    WHERE tipo_arquivo = 'volumetria_fora_padrao_retroativo';
    
    -- Log dos números finais
    RAISE NOTICE 'Volumetria Padrão: % registros', volumetria_padrao_count;
    RAISE NOTICE 'Volumetria Padrão Retroativo: % registros', volumetria_padrao_retroativo_count;
    RAISE NOTICE 'Volumetria Fora Padrão: % registros', volumetria_fora_padrao_count;
    RAISE NOTICE 'Volumetria Fora Padrão Retroativo: % registros', volumetria_fora_padrao_retroativo_count;
END $$;