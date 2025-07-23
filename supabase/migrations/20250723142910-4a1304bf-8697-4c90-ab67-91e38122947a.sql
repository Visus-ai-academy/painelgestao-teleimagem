-- ============= ÍNDICES PARA PERFORMANCE =============

-- Volumetria (tabela mais consultada)
CREATE INDEX IF NOT EXISTS idx_volumetria_data_referencia ON volumetria_mobilemed(data_referencia);
CREATE INDEX IF NOT EXISTS idx_volumetria_empresa ON volumetria_mobilemed(EMPRESA);
CREATE INDEX IF NOT EXISTS idx_volumetria_modalidade ON volumetria_mobilemed(MODALIDADE);
CREATE INDEX IF NOT EXISTS idx_volumetria_especialidade ON volumetria_mobilemed(ESPECIALIDADE);
CREATE INDEX IF NOT EXISTS idx_volumetria_empresa_data ON volumetria_mobilemed(EMPRESA, data_referencia);
CREATE INDEX IF NOT EXISTS idx_volumetria_valores ON volumetria_mobilemed(VALORES) WHERE VALORES > 0;

-- Faturamento
CREATE INDEX IF NOT EXISTS idx_faturamento_data_emissao ON faturamento(data_emissao);
CREATE INDEX IF NOT EXISTS idx_faturamento_cliente_data ON faturamento(cliente_id, data_emissao);
CREATE INDEX IF NOT EXISTS idx_faturamento_omie_id ON faturamento(omie_id);

-- Exames
CREATE INDEX IF NOT EXISTS idx_exames_data_medico ON exames(data_exame, medico_id);
CREATE INDEX IF NOT EXISTS idx_exames_cliente_data ON exames(cliente_id, data_exame);

-- Escalas médicas
CREATE INDEX IF NOT EXISTS idx_escalas_data_medico ON escalas_medicas(data, medico_id);

-- Clientes performance
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status) WHERE status = 'Ativo';
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj) WHERE cnpj IS NOT NULL;