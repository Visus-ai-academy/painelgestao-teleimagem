-- 📊 ÍNDICES DE PERFORMANCE ESSENCIAIS

-- Índices básicos para otimização de consultas críticas
CREATE INDEX IF NOT EXISTS idx_clientes_ativo_nome ON clientes(ativo, nome) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_volumetria_empresa_data ON volumetria_mobilemed("EMPRESA", data_referencia);
CREATE INDEX IF NOT EXISTS idx_precos_cliente_ativo ON precos_servicos(cliente_id, ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_escalas_medico_data ON escalas_medicas(medico_id, data);
CREATE INDEX IF NOT EXISTS idx_faturamento_cliente_periodo ON faturamento(cliente_id, periodo_referencia);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performance ON audit_logs(table_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_upload_logs_status_created ON upload_logs(status, created_at DESC);

-- Índices para consultas de autenticação e roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);

-- Índices para volumetria com atrasos (consulta frequente)
CREATE INDEX IF NOT EXISTS idx_volumetria_atraso ON volumetria_mobilemed("DATA_LAUDO", "DATA_PRAZO", "HORA_LAUDO", "HORA_PRAZO") 
WHERE "DATA_LAUDO" IS NOT NULL AND "DATA_PRAZO" IS NOT NULL;