-- Habilitar RLS na tabela processamento_uploads se não estiver habilitado
ALTER TABLE public.processamento_uploads ENABLE ROW LEVEL SECURITY;

-- Criar políticas para visualização dos uploads
CREATE POLICY "Admins podem ver todos os uploads" 
ON public.processamento_uploads 
FOR SELECT 
TO authenticated 
USING (is_admin());

CREATE POLICY "Managers podem ver todos os uploads" 
ON public.processamento_uploads 
FOR SELECT 
TO authenticated 
USING (is_manager_or_admin());

-- Permitir que o sistema insira registros de processamento
CREATE POLICY "Sistema pode inserir logs de processamento" 
ON public.processamento_uploads 
FOR INSERT 
TO authenticated 
WITH CHECK (true);