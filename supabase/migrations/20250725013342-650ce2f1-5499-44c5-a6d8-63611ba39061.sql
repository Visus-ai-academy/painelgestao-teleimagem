-- Criar política temporária mais permissiva para volumetria_mobilemed
-- Isso permitirá que usuários autenticados vejam os dados básicos

-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "Acesso otimizado volumetria" ON public.volumetria_mobilemed;

-- Criar política mais permissiva para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver volumetria básica"
ON public.volumetria_mobilemed
FOR SELECT
TO authenticated
USING (true);

-- Manter a política de admin para gerenciar
-- (a política "Admins podem gerenciar volumetria" já existe)

-- Verificar e ajustar também a política de clientes se necessário
-- A política atual permite que todos vejam clientes, então deve estar ok