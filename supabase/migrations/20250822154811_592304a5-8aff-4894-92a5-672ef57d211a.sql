-- Adicionar política RLS para permitir inserção via edge function
CREATE POLICY "Sistema pode inserir dados volumetria"
ON public.volumetria_mobilemed
FOR INSERT
WITH CHECK (true);

-- Garantir que a política de sistema seja permissiva
ALTER TABLE public.volumetria_mobilemed ENABLE ROW LEVEL SECURITY;