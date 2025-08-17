-- Aplicar quebras sem referenciar coluna inexistente
WITH registros_para_quebrar AS (
  SELECT * FROM volumetria_mobilemed 
  WHERE processamento_pendente = true 
  AND arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
),
regras_aplicaveis AS (
  SELECT 
    r.*,
    rqe.exame_quebrado,
    rqe.categoria_quebrada
  FROM registros_para_quebrar r
  INNER JOIN regras_quebra_exames rqe ON rqe.exame_original = r."ESTUDO_DESCRICAO" 
  AND rqe.ativo = true
),
novos_registros AS (
  SELECT 
    gen_random_uuid() as id,
    "EMPRESA",
    "NOME_PACIENTE", 
    "CODIGO_PACIENTE",
    exame_quebrado as "ESTUDO_DESCRICAO",
    "ACCESSION_NUMBER",
    "MODALIDADE",
    "PRIORIDADE", 
    COALESCE("VALORES", 1) as "VALORES",
    "ESPECIALIDADE",
    "MEDICO",
    "DUPLICADO",
    "DATA_REALIZACAO",
    "HORA_REALIZACAO",
    "DATA_TRANSFERENCIA", 
    "HORA_TRANSFERENCIA",
    "DATA_LAUDO",
    "HORA_LAUDO",
    "DATA_PRAZO",
    "HORA_PRAZO",
    "STATUS",
    "DATA_REASSINATURA",
    "HORA_REASSINATURA", 
    "MEDICO_REASSINATURA",
    "SEGUNDA_ASSINATURA",
    "POSSUI_IMAGENS_CHAVE",
    "IMAGENS_CHAVES",
    "IMAGENS_CAPTURADAS",
    "CODIGO_INTERNO",
    "DIGITADOR",
    "COMPLEMENTAR",
    data_referencia,
    arquivo_fonte,
    lote_upload,
    periodo_referencia,
    COALESCE(categoria_quebrada, "CATEGORIA") as "CATEGORIA",
    created_at,
    now() as updated_at,
    tipo_faturamento,
    false as processamento_pendente
  FROM regras_aplicaveis
)
INSERT INTO volumetria_mobilemed 
SELECT * FROM novos_registros;

-- Remover registros originais que foram quebrados
DELETE FROM volumetria_mobilemed 
WHERE processamento_pendente = true 
AND arquivo_fonte IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo')
AND EXISTS (
  SELECT 1 FROM regras_quebra_exames rqe 
  WHERE rqe.exame_original = volumetria_mobilemed."ESTUDO_DESCRICAO" 
  AND rqe.ativo = true
);