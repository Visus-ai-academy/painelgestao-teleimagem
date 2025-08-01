-- Criar policies para tabelas renomeadas

-- Policies para logs_ativacao
CREATE POLICY "Médicos podem ver seus próprios logs de ativação" 
ON logs_ativacao FOR SELECT 
TO authenticated
USING (
  (medico_id IN ( SELECT medicos.id
   FROM medicos
  WHERE (medicos.user_id = auth.uid()))) OR is_manager_or_admin()
);

-- Policies para ativacao_medico
CREATE POLICY "Médicos podem gerenciar sua própria ativação" 
ON ativacao_medico FOR ALL 
TO authenticated
USING (
  (medico_id IN ( SELECT medicos.id
   FROM medicos
  WHERE (medicos.user_id = auth.uid()))) OR is_manager_or_admin()
)
WITH CHECK (
  (medico_id IN ( SELECT medicos.id
   FROM medicos
  WHERE (medicos.user_id = auth.uid()))) OR is_manager_or_admin()
);

CREATE POLICY "Managers podem monitorar todas ativações" 
ON ativacao_medico FOR SELECT 
TO authenticated
USING (is_manager_or_admin());