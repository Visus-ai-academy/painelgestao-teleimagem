-- Criar tabela para armazenar registros de volumetria com erros de validação
CREATE TABLE public.volumetria_erros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  nome_paciente TEXT NOT NULL,
  arquivo_fonte TEXT NOT NULL,
  erro_detalhes TEXT NOT NULL,
  dados_originais JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  corrigido_em TIMESTAMP WITH TIME ZONE NULL,
  corrigido_por UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar RLS
ALTER TABLE public.volumetria_erros ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Admins podem gerenciar erros volumetria" 
ON public.volumetria_erros 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver erros volumetria" 
ON public.volumetria_erros 
FOR SELECT 
USING (is_manager_or_admin());

-- Índices para performance
CREATE INDEX idx_volumetria_erros_empresa ON public.volumetria_erros(empresa);
CREATE INDEX idx_volumetria_erros_arquivo_fonte ON public.volumetria_erros(arquivo_fonte);
CREATE INDEX idx_volumetria_erros_status ON public.volumetria_erros(status);
CREATE INDEX idx_volumetria_erros_created_at ON public.volumetria_erros(created_at);

-- Trigger para updated_at
CREATE TRIGGER update_volumetria_erros_updated_at
BEFORE UPDATE ON public.volumetria_erros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();