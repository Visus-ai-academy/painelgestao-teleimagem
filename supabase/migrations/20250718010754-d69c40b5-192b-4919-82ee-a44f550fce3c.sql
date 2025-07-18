-- Criar tabela para documentos dos clientes
CREATE TABLE public.documentos_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('contrato', 'termo_aditivo', 'termo_renovacao')),
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT,
  status_documento TEXT NOT NULL DEFAULT 'pendente' CHECK (status_documento IN ('pendente', 'anexado', 'assinatura_pendente', 'assinado')),
  clicksign_document_key TEXT,
  data_envio_assinatura TIMESTAMP WITH TIME ZONE,
  data_assinatura TIMESTAMP WITH TIME ZONE,
  signatarios JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.documentos_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admins podem gerenciar documentos" 
ON public.documentos_clientes 
FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver documentos" 
ON public.documentos_clientes 
FOR SELECT 
USING (is_manager_or_admin());

-- Criar trigger para updated_at
CREATE TRIGGER update_documentos_clientes_updated_at
BEFORE UPDATE ON public.documentos_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para armazenamento de documentos
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-clientes', 'documentos-clientes', false);

-- Políticas para o storage bucket
CREATE POLICY "Admins podem ver documentos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documentos-clientes' AND is_admin());

CREATE POLICY "Admins podem fazer upload de documentos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documentos-clientes' AND is_admin());

CREATE POLICY "Admins podem atualizar documentos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documentos-clientes' AND is_admin());

CREATE POLICY "Sistema pode gerenciar documentos" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'documentos-clientes');