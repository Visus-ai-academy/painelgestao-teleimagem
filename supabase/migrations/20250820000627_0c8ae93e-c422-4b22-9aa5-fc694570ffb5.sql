-- Verificar se bucket uploads existe, se não, criar
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas para permitir upload e download de arquivos
CREATE POLICY "Usuários podem fazer upload de arquivos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem baixar arquivos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'uploads');

CREATE POLICY "Sistema pode acessar todos os arquivos" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'uploads');