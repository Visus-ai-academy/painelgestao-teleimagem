-- Verificar e corrigir permissões do bucket uploads
-- Criar políticas para o bucket uploads se não existirem

-- Política para download de arquivos
DROP POLICY IF EXISTS "Authenticated users can download uploads" ON storage.objects;
CREATE POLICY "Authenticated users can download uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'uploads');

-- Política para upload de arquivos
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'uploads');

-- Política para atualizar arquivos
DROP POLICY IF EXISTS "Authenticated users can update uploads" ON storage.objects;
CREATE POLICY "Authenticated users can update uploads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'uploads');

-- Garantir que o bucket uploads seja público para leitura
UPDATE storage.buckets 
SET public = true 
WHERE id = 'uploads';