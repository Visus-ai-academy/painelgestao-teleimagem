-- Habilitar RLS na tabela parametros_faturamento para resolver issue de segurança

ALTER TABLE parametros_faturamento ENABLE ROW LEVEL SECURITY;

-- Criar policies para parametros_faturamento
CREATE POLICY "Admins podem gerenciar parâmetros faturamento" 
ON parametros_faturamento FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Managers podem ver parâmetros faturamento" 
ON parametros_faturamento FOR SELECT 
TO authenticated 
USING (public.is_manager_or_admin());