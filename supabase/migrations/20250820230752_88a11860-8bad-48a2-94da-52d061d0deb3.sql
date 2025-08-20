-- Adicionar campos em falta na tabela parametros_faturamento para comportar todas as colunas do template

-- Campos do template que estão faltando
ALTER TABLE parametros_faturamento 
ADD COLUMN IF NOT EXISTS cliente_consolidado TEXT,
ADD COLUMN IF NOT EXISTS impostos_ab_min DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS simples BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tipo_metrica_convenio TEXT, -- 'valor_fixo', 'percentual'
ADD COLUMN IF NOT EXISTS tipo_metrica_urgencia TEXT, -- 'valor_fixo', 'percentual'
ADD COLUMN IF NOT EXISTS tipo_desconto_acrescimo TEXT, -- 'desconto', 'acrescimo'
ADD COLUMN IF NOT EXISTS desconto_acrescimo DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_inicio_integracao DATE,
ADD COLUMN IF NOT EXISTS portal_laudos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS percentual_iss DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cobrar_urgencia_como_rotina BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS incluir_empresa_origem BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS incluir_access_number BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS incluir_medico_solicitante BOOLEAN DEFAULT false;

-- Comentários para documentar os campos
COMMENT ON COLUMN parametros_faturamento.cliente_consolidado IS 'Nome do cliente consolidado/grupo';
COMMENT ON COLUMN parametros_faturamento.impostos_ab_min IS 'Percentual de impostos abaixo do mínimo';
COMMENT ON COLUMN parametros_faturamento.simples IS 'Se o cliente está no regime Simples Nacional';
COMMENT ON COLUMN parametros_faturamento.tipo_metrica_convenio IS 'Como calcular valor convênio: valor_fixo ou percentual';
COMMENT ON COLUMN parametros_faturamento.tipo_metrica_urgencia IS 'Como calcular valor urgência: valor_fixo ou percentual';
COMMENT ON COLUMN parametros_faturamento.tipo_desconto_acrescimo IS 'Se é desconto ou acréscimo';
COMMENT ON COLUMN parametros_faturamento.desconto_acrescimo IS 'Percentual de desconto ou acréscimo';
COMMENT ON COLUMN parametros_faturamento.data_inicio_integracao IS 'Data de início da integração';
COMMENT ON COLUMN parametros_faturamento.portal_laudos IS 'Se tem acesso ao portal de laudos';
COMMENT ON COLUMN parametros_faturamento.percentual_iss IS 'Percentual de ISS a ser aplicado';
COMMENT ON COLUMN parametros_faturamento.cobrar_urgencia_como_rotina IS 'Se deve cobrar urgência como rotina';
COMMENT ON COLUMN parametros_faturamento.incluir_empresa_origem IS 'Se deve incluir empresa origem no faturamento';
COMMENT ON COLUMN parametros_faturamento.incluir_access_number IS 'Se deve incluir access number no faturamento';
COMMENT ON COLUMN parametros_faturamento.incluir_medico_solicitante IS 'Se deve incluir médico solicitante no faturamento';