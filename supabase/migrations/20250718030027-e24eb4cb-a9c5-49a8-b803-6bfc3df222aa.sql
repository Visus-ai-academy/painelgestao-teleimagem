-- Verificar e criar bucket para logomarcas se não existir
INSERT INTO storage.buckets (id, name, public)
SELECT 'logomarcas', 'logomarcas', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'logomarcas'
);

-- Criar políticas para acesso público às logomarcas
CREATE POLICY "Logomarcas são acessíveis publicamente" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logomarcas');

CREATE POLICY "Admins podem enviar logomarcas" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'logomarcas' AND is_admin());

CREATE POLICY "Admins podem atualizar logomarcas" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'logomarcas' AND is_admin());

CREATE POLICY "Admins podem deletar logomarcas" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'logomarcas' AND is_admin());