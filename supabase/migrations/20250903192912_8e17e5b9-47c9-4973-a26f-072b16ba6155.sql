-- Corrigir RLS na tabela parametros_faturamento usando função existente

ALTER TABLE parametros_faturamento ENABLE ROW LEVEL SECURITY;

-- Criar policies para parametros_faturamento usando função específica com parâmetros
CREATE POLICY "Admins podem gerenciar parâmetros faturamento" 
ON parametros_faturamento FOR ALL 
TO authenticated 
USING (is_admin(auth.uid())) 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Managers podem ver parâmetros faturamento" 
ON parametros_faturamento FOR SELECT 
TO authenticated 
USING (is_manager_or_admin(auth.uid()));