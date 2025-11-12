-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem ver preços ativos" ON public.precos_servicos;
DROP POLICY IF EXISTS "Usuarios autenticados podem ver precos" ON public.precos_servicos;

-- Criar política que permite usuários autenticados verem preços ativos
CREATE POLICY "Usuarios autenticados podem ver precos"
ON public.precos_servicos
FOR SELECT
USING (
  ativo = true 
  AND auth.uid() IS NOT NULL
);