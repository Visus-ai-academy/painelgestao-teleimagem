-- Reativar RLS na tabela clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clientes;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON clientes;  
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clientes;
DROP POLICY IF EXISTS "Admins can delete clients" ON clientes;

-- Criar políticas mais simples e funcionais
CREATE POLICY "Usuários autenticados podem ver clientes" ON clientes
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir clientes" ON clientes
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes" ON clientes
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Admins podem deletar clientes" ON clientes
FOR DELETE TO authenticated
USING (is_admin());