-- =====================================================
-- CONTINUAÇÃO - OTIMIZAÇÃO DE POLÍTICAS RLS
-- =====================================================

-- cadastro_exames - já existe, apenas drop duplicada
DROP POLICY IF EXISTS "Admins podem gerenciar cadastro exames" ON public.cadastro_exames;
DROP POLICY IF EXISTS "Managers podem ver cadastro exames" ON public.cadastro_exames;
CREATE POLICY "Admins podem gerenciar cadastro exames"
ON public.cadastro_exames FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Managers podem ver cadastro exames"
ON public.cadastro_exames FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'manager'));

-- categorias_exame
DROP POLICY IF EXISTS "Admins podem gerenciar categorias exame" ON public.categorias_exame;
DROP POLICY IF EXISTS "Usuarios podem visualizar categorias exame" ON public.categorias_exame;
CREATE POLICY "Admins podem gerenciar categorias exame"
ON public.categorias_exame FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Usuarios podem visualizar categorias exame"
ON public.categorias_exame FOR SELECT TO authenticated
USING (ativo = true);

-- categorias_medico
DROP POLICY IF EXISTS "Admins podem gerenciar categorias medico" ON public.categorias_medico;
DROP POLICY IF EXISTS "Usuarios podem visualizar categorias medico" ON public.categorias_medico;
CREATE POLICY "Admins podem gerenciar categorias medico"
ON public.categorias_medico FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Usuarios podem visualizar categorias medico"
ON public.categorias_medico FOR SELECT TO authenticated
USING (ativo = true);

-- coberturas_escala
DROP POLICY IF EXISTS "Admins podem gerenciar todas as coberturas" ON public.coberturas_escala;
CREATE POLICY "Admins podem gerenciar todas as coberturas"
ON public.coberturas_escala FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));

-- configuracoes_escala
DROP POLICY IF EXISTS "Admins podem gerenciar configuracoes escala" ON public.configuracoes_escala;
DROP POLICY IF EXISTS "Usuarios podem ver configuracoes escala" ON public.configuracoes_escala;
CREATE POLICY "Admins podem gerenciar configuracoes escala"
ON public.configuracoes_escala FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Usuarios podem ver configuracoes escala"
ON public.configuracoes_escala FOR SELECT TO authenticated
USING (ativo = true);

-- contratos_clientes
DROP POLICY IF EXISTS "Admins podem gerenciar contratos clientes" ON public.contratos_clientes;
DROP POLICY IF EXISTS "Managers podem ver contratos clientes" ON public.contratos_clientes;
CREATE POLICY "Admins podem gerenciar contratos clientes"
ON public.contratos_clientes FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Managers podem ver contratos clientes"
ON public.contratos_clientes FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'manager'));

-- controle_dados_origem
DROP POLICY IF EXISTS "Admins podem gerenciar controle origem" ON public.controle_dados_origem;
DROP POLICY IF EXISTS "Managers podem ver controle origem" ON public.controle_dados_origem;
CREATE POLICY "Admins podem gerenciar controle origem"
ON public.controle_dados_origem FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Managers podem ver controle origem"
ON public.controle_dados_origem FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'manager'));

-- custom_metric_values
DROP POLICY IF EXISTS "Admins podem gerenciar valores metricas" ON public.custom_metric_values;
DROP POLICY IF EXISTS "Usuarios podem ver valores metricas" ON public.custom_metric_values;
CREATE POLICY "Admins podem gerenciar valores metricas"
ON public.custom_metric_values FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Usuarios podem ver valores metricas"
ON public.custom_metric_values FOR SELECT TO authenticated
USING (true);

-- custom_metrics
DROP POLICY IF EXISTS "Admins podem gerenciar metricas customizadas" ON public.custom_metrics;
DROP POLICY IF EXISTS "Managers podem ver metricas customizadas" ON public.custom_metrics;
CREATE POLICY "Admins podem gerenciar metricas customizadas"
ON public.custom_metrics FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Managers podem ver metricas customizadas"
ON public.custom_metrics FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'manager'));

-- documentos_clientes
DROP POLICY IF EXISTS "Admins podem gerenciar documentos" ON public.documentos_clientes;
DROP POLICY IF EXISTS "Managers podem ver documentos" ON public.documentos_clientes;
CREATE POLICY "Admins podem gerenciar documentos"
ON public.documentos_clientes FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Managers podem ver documentos"
ON public.documentos_clientes FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'manager'));

-- =====================================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_medicos_user_id ON public.medicos (user_id);
CREATE INDEX IF NOT EXISTS idx_escalas_medicas_medico_id ON public.escalas_medicas (medico_id);
CREATE INDEX IF NOT EXISTS idx_exames_medico_id ON public.exames (medico_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_medicas_medico_id ON public.ausencias_medicas (medico_id);
CREATE INDEX IF NOT EXISTS idx_coberturas_escala_medico_ofereceu_id ON public.coberturas_escala (medico_ofereceu_id);
CREATE INDEX IF NOT EXISTS idx_coberturas_escala_medico_aceitou_id ON public.coberturas_escala (medico_aceitou_id);
CREATE INDEX IF NOT EXISTS idx_ativacao_medico_medico_id ON public.ativacao_medico (medico_id);
CREATE INDEX IF NOT EXISTS idx_logs_ativacao_medico_id ON public.logs_ativacao (medico_id);
CREATE INDEX IF NOT EXISTS idx_capacidade_produtiva_medico_id ON public.capacidade_produtiva_medico (medico_id);
CREATE INDEX IF NOT EXISTS idx_medicos_valores_adicionais_medico_id ON public.medicos_valores_adicionais (medico_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_repasse_status_medico_id ON public.relatorios_repasse_status (medico_id);
CREATE INDEX IF NOT EXISTS idx_documentos_clientes_medico_id ON public.documentos_clientes (medico_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON public.user_2fa (user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consent_user_id ON public.lgpd_consent (user_id);