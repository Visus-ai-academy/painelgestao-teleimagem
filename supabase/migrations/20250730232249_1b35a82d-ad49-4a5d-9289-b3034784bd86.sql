-- Criar política mais permissiva para visualização dos valores de referência
-- Usuários autenticados podem ver os valores de referência
CREATE POLICY "Usuários podem visualizar valores referência" 
ON valores_referencia_de_para 
FOR SELECT 
USING (true);