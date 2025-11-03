-- Criar bucket para armazenar relatórios de repasse (ignora se já existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'relatorios-repasse',
  'relatorios-repasse',
  true,
  10485760, -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas apenas se não existirem
DO $$ 
BEGIN
  -- Política para permitir leitura pública dos relatórios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Relatórios podem ser visualizados publicamente'
  ) THEN
    CREATE POLICY "Relatórios podem ser visualizados publicamente"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'relatorios-repasse');
  END IF;

  -- Política para permitir upload de relatórios por usuários autenticados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem fazer upload de relatórios'
  ) THEN
    CREATE POLICY "Usuários autenticados podem fazer upload de relatórios"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'relatorios-repasse' 
      AND auth.role() = 'authenticated'
    );
  END IF;

  -- Política para permitir atualização de relatórios por usuários autenticados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem atualizar relatórios'
  ) THEN
    CREATE POLICY "Usuários autenticados podem atualizar relatórios"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'relatorios-repasse' 
      AND auth.role() = 'authenticated'
    );
  END IF;

  -- Política para permitir exclusão de relatórios por usuários autenticados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Usuários autenticados podem deletar relatórios'
  ) THEN
    CREATE POLICY "Usuários autenticados podem deletar relatórios"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'relatorios-repasse' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;