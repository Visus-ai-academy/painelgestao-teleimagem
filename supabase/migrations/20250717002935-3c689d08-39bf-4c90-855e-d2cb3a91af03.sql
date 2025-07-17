-- Verificar se o bucket 'uploads' existe e criar se necessário
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de acesso ao bucket uploads
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated users to view files"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete files"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');