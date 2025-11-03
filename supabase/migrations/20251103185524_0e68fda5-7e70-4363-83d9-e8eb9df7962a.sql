-- Garantir bucket público para relatórios de repasse e políticas necessárias
DO $$
BEGIN
  -- Cria o bucket se não existir e garante que seja público
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'relatorios-repasse'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('relatorios-repasse', 'relatorios-repasse', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE id = 'relatorios-repasse';
  END IF;
END $$;

-- Políticas de acesso no storage.objects
DO $$
BEGIN
  -- Leitura pública (útil para acesso via link público)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view repasse reports'
  ) THEN
    CREATE POLICY "Public can view repasse reports"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'relatorios-repasse');
  END IF;

  -- Permitir upload no bucket para chamadas (anon ou authenticated), restrito ao bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Upload repasse reports'
  ) THEN
    CREATE POLICY "Upload repasse reports"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'relatorios-repasse');
  END IF;

  -- Permitir atualização (necessário para upsert) no mesmo bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Update repasse reports'
  ) THEN
    CREATE POLICY "Update repasse reports"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'relatorios-repasse');
  END IF;
END $$;