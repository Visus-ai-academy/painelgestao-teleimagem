-- Análise e correção da estrutura de parâmetros de faturamento

-- 1. Adicionar campos que estão no template CSV mas faltam na tabela parametros_faturamento
ALTER TABLE parametros_faturamento 
ADD COLUMN IF NOT EXISTS dia_fechamento INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS forma_cobranca TEXT DEFAULT 'mensal';

-- 2. Adicionar campos que estão nos parâmetros mas faltam nos contratos para sincronização completa
ALTER TABLE contratos_clientes 
ADD COLUMN IF NOT EXISTS dia_fechamento INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS periodicidade_reajuste TEXT DEFAULT 'anual',
ADD COLUMN IF NOT EXISTS indice_reajuste TEXT DEFAULT 'IPCA',
ADD COLUMN IF NOT EXISTS percentual_reajuste_fixo DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_aniversario_contrato DATE,
ADD COLUMN IF NOT EXISTS impostos_ab_min DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS percentual_iss DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS simples BOOLEAN DEFAULT false;

-- 3. Comentários para documentar os novos campos
COMMENT ON COLUMN parametros_faturamento.dia_fechamento IS 'Dia do mês para fechamento do faturamento';
COMMENT ON COLUMN parametros_faturamento.forma_cobranca IS 'Forma de cobrança: mensal, quinzenal, etc';

COMMENT ON COLUMN contratos_clientes.dia_fechamento IS 'Dia do mês para fechamento - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.periodicidade_reajuste IS 'Periodicidade dos reajustes - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.indice_reajuste IS 'Índice usado para reajuste - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.percentual_reajuste_fixo IS 'Percentual fixo de reajuste - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.data_aniversario_contrato IS 'Data de aniversário do contrato - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.impostos_ab_min IS 'Impostos abaixo do mínimo - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.percentual_iss IS 'Percentual de ISS - sincronizado dos parâmetros';
COMMENT ON COLUMN contratos_clientes.simples IS 'Regime Simples Nacional - sincronizado dos parâmetros';