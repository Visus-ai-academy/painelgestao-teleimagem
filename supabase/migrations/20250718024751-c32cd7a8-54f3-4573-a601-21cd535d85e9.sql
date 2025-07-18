-- Criar bucket de uploads se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de storage para o bucket uploads
CREATE POLICY "Admins podem fazer upload de arquivos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'uploads' AND is_admin());

CREATE POLICY "Admins podem ver arquivos de upload" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'uploads' AND is_admin());

CREATE POLICY "Admins podem deletar arquivos de upload" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'uploads' AND is_admin());