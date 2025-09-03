-- Adicionar campos faltantes na tabela parametros_faturamento para mapear todos os campos do Excel

ALTER TABLE parametros_faturamento 
ADD COLUMN IF NOT EXISTS nome_mobilemed TEXT,
ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS numero_contrato TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS dia_faturamento INTEGER,
ADD COLUMN IF NOT EXISTS data_inicio_contrato DATE,
ADD COLUMN IF NOT EXISTS data_termino_contrato DATE,
ADD COLUMN IF NOT EXISTS criterio_emissao_nf TEXT,
ADD COLUMN IF NOT EXISTS criterios_geracao_relatorio TEXT,
ADD COLUMN IF NOT EXISTS criterios_aplicacao_parametros TEXT,
ADD COLUMN IF NOT EXISTS criterios_aplicacao_franquias TEXT,
ADD COLUMN IF NOT EXISTS tipo_faturamento TEXT;