-- Otimização de RLS Policies: auth.uid() → (select auth.uid())
-- Esta mudança é puramente de performance, sem impacto funcional

-- 1. documentos_clientes
DROP POLICY IF EXISTS "Médicos podem ver seus próprios documentos" ON public.documentos_clientes;
CREATE POLICY "Médicos podem ver seus próprios documentos" ON public.documentos_clientes
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 2. medicos - SELECT admins/managers
DROP POLICY IF EXISTS "Admins e managers podem ver todos os médicos" ON public.medicos;
CREATE POLICY "Admins e managers podem ver todos os médicos" ON public.medicos
FOR SELECT USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 3. medicos - SELECT próprio perfil
DROP POLICY IF EXISTS "Médicos podem ver seu próprio perfil" ON public.medicos;
CREATE POLICY "Médicos podem ver seu próprio perfil" ON public.medicos
FOR SELECT USING (user_id = (select auth.uid()));

-- 4. medicos - ALL admins
DROP POLICY IF EXISTS "Admins podem gerenciar médicos" ON public.medicos;
CREATE POLICY "Admins podem gerenciar médicos" ON public.medicos
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 5. escalas_medicas - SELECT médicos
DROP POLICY IF EXISTS "Médicos podem ver apenas suas escalas" ON public.escalas_medicas;
CREATE POLICY "Médicos podem ver apenas suas escalas" ON public.escalas_medicas
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 6. escalas_medicas - SELECT admins/managers
DROP POLICY IF EXISTS "Admins e managers podem ver todas as escalas" ON public.escalas_medicas;
CREATE POLICY "Admins e managers podem ver todas as escalas" ON public.escalas_medicas
FOR SELECT USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 7. escalas_medicas - UPDATE ausência
DROP POLICY IF EXISTS "Médicos podem informar ausência" ON public.escalas_medicas;
CREATE POLICY "Médicos podem informar ausência" ON public.escalas_medicas
FOR UPDATE USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 8. escalas_medicas - ALL admins/managers
DROP POLICY IF EXISTS "Admins e managers podem gerenciar escalas" ON public.escalas_medicas;
CREATE POLICY "Admins e managers podem gerenciar escalas" ON public.escalas_medicas
FOR ALL USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 9-11. escalas_medicas - Proteção temporal
DROP POLICY IF EXISTS "Proteção temporal - SELECT escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - SELECT escalas" ON public.escalas_medicas
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Proteção temporal - UPDATE escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - UPDATE escalas" ON public.escalas_medicas
FOR UPDATE USING (
  public.has_role((select auth.uid()), 'admin') OR 
  public.has_role((select auth.uid()), 'manager') OR
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Proteção temporal - INSERT escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - INSERT escalas" ON public.escalas_medicas
FOR INSERT WITH CHECK (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 12. exames - SELECT médicos
DROP POLICY IF EXISTS "Médicos podem ver seus próprios exames" ON public.exames;
CREATE POLICY "Médicos podem ver seus próprios exames" ON public.exames
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 13. exames - Proteção temporal
DROP POLICY IF EXISTS "Proteção temporal - SELECT exames" ON public.exames;
CREATE POLICY "Proteção temporal - SELECT exames" ON public.exames
FOR SELECT USING (true);

-- 14. pagamentos_medicos
DROP POLICY IF EXISTS "Médicos podem ver seus próprios pagamentos" ON public.pagamentos_medicos;
CREATE POLICY "Médicos podem ver seus próprios pagamentos" ON public.pagamentos_medicos
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 15. user_2fa
DROP POLICY IF EXISTS "Usuários podem gerenciar seu 2FA" ON public.user_2fa;
CREATE POLICY "Usuários podem gerenciar seu 2FA" ON public.user_2fa
FOR ALL USING (user_id = (select auth.uid()));

-- 16. lgpd_consent
DROP POLICY IF EXISTS "Usuários podem ver seus consentimentos" ON public.lgpd_consent;
CREATE POLICY "Usuários podem ver seus consentimentos" ON public.lgpd_consent
FOR SELECT USING (user_id = (select auth.uid()));

-- 17-19. ausencias_medicas
DROP POLICY IF EXISTS "Médicos podem ver suas ausências" ON public.ausencias_medicas;
CREATE POLICY "Médicos podem ver suas ausências" ON public.ausencias_medicas
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem criar suas ausências" ON public.ausencias_medicas;
CREATE POLICY "Médicos podem criar suas ausências" ON public.ausencias_medicas
FOR INSERT WITH CHECK (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem editar suas ausências pendentes" ON public.ausencias_medicas;
CREATE POLICY "Médicos podem editar suas ausências pendentes" ON public.ausencias_medicas
FOR UPDATE USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid())) AND aprovado IS NULL
);

-- 20. capacidade_produtiva_medico
DROP POLICY IF EXISTS "Médicos podem ver sua capacidade" ON public.capacidade_produtiva_medico;
CREATE POLICY "Médicos podem ver sua capacidade" ON public.capacidade_produtiva_medico
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 21-23. coberturas_escala
DROP POLICY IF EXISTS "Médicos podem ver coberturas relacionadas a eles" ON public.coberturas_escala;
CREATE POLICY "Médicos podem ver coberturas relacionadas a eles" ON public.coberturas_escala
FOR SELECT USING (
  medico_ofereceu_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid())) OR
  medico_aceitou_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem oferecer suas escalas" ON public.coberturas_escala;
CREATE POLICY "Médicos podem oferecer suas escalas" ON public.coberturas_escala
FOR INSERT WITH CHECK (
  medico_ofereceu_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem aceitar coberturas" ON public.coberturas_escala;
CREATE POLICY "Médicos podem aceitar coberturas" ON public.coberturas_escala
FOR UPDATE USING (
  medico_aceitou_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid())) OR
  medico_ofereceu_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 24-25. ativacao_medico
DROP POLICY IF EXISTS "Médicos podem gerenciar sua própria ativação" ON public.ativacao_medico;
CREATE POLICY "Médicos podem gerenciar sua própria ativação" ON public.ativacao_medico
FOR ALL USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem gerenciar sua própria presença" ON public.ativacao_medico;
CREATE POLICY "Médicos podem gerenciar sua própria presença" ON public.ativacao_medico
FOR ALL USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 26-27. logs_ativacao
DROP POLICY IF EXISTS "Médicos podem ver seus próprios logs" ON public.logs_ativacao;
CREATE POLICY "Médicos podem ver seus próprios logs" ON public.logs_ativacao
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

DROP POLICY IF EXISTS "Médicos podem ver seus próprios logs de ativação" ON public.logs_ativacao;
CREATE POLICY "Médicos podem ver seus próprios logs de ativação" ON public.logs_ativacao
FOR SELECT USING (
  medico_id IN (SELECT id FROM medicos WHERE user_id = (select auth.uid()))
);

-- 28. volumetria_mobilemed
DROP POLICY IF EXISTS "Admins_managers_can_access_volumetria" ON public.volumetria_mobilemed;
CREATE POLICY "Admins_managers_can_access_volumetria" ON public.volumetria_mobilemed
FOR ALL USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 29-30. clientes
DROP POLICY IF EXISTS "Managers_can_manage_clientes" ON public.clientes;
CREATE POLICY "Managers_can_manage_clientes" ON public.clientes
FOR ALL USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

DROP POLICY IF EXISTS "Users_can_view_clientes" ON public.clientes;
CREATE POLICY "Users_can_view_clientes" ON public.clientes
FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- 31-32. fechamento_faturamento
DROP POLICY IF EXISTS "Admins podem gerenciar fechamentos" ON public.fechamento_faturamento;
CREATE POLICY "Admins podem gerenciar fechamentos" ON public.fechamento_faturamento
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Managers podem ver fechamentos" ON public.fechamento_faturamento;
CREATE POLICY "Managers podem ver fechamentos" ON public.fechamento_faturamento
FOR SELECT USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);