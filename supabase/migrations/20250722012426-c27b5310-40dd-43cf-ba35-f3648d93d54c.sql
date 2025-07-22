-- Garantir que o bucket relatorios-faturamento seja público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'relatorios-faturamento';

-- Criar políticas para permitir acesso aos arquivos
CREATE POLICY "Permitir download público de relatórios" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'relatorios-faturamento');

CREATE POLICY "Permitir upload de relatórios para admins" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'relatorios-faturamento' AND auth.uid() IS NOT NULL);