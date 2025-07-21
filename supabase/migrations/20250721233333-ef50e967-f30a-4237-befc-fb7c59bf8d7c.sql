-- Criar bucket para relatórios de faturamento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('relatorios-faturamento', 'relatorios-faturamento', true);

-- Criar política para permitir upload de relatórios
CREATE POLICY "Permitir upload de relatórios" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'relatorios-faturamento');

-- Criar política para permitir acesso público aos relatórios
CREATE POLICY "Permitir acesso público aos relatórios" ON storage.objects
  FOR SELECT USING (bucket_id = 'relatorios-faturamento');