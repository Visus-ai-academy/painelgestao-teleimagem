-- Criar tabela para logs de upload
CREATE TABLE IF NOT EXISTS public.upload_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Admins podem gerenciar logs de upload" 
ON public.upload_logs 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver logs de upload" 
ON public.upload_logs 
FOR SELECT 
USING (is_manager_or_admin());

-- Criar trigger para updated_at
CREATE TRIGGER update_upload_logs_updated_at
BEFORE UPDATE ON public.upload_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();