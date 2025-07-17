-- Criar bucket para relatórios de faturamento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('relatorios-faturamento', 'relatorios-faturamento', true);

-- Política para permitir que usuários autenticados vejam os relatórios
CREATE POLICY "Usuários autenticados podem ver relatórios" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'relatorios-faturamento' AND auth.role() = 'authenticated');

-- Política para permitir que usuários autenticados criem relatórios
CREATE POLICY "Usuários autenticados podem criar relatórios" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'relatorios-faturamento' AND auth.role() = 'authenticated');

-- Política para permitir que usuários autenticados atualizem relatórios
CREATE POLICY "Usuários autenticados podem atualizar relatórios" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'relatorios-faturamento' AND auth.role() = 'authenticated');