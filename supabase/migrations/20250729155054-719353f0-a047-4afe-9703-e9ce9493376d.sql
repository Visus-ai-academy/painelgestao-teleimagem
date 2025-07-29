-- Criar tabela para regras de quebra de exames
CREATE TABLE public.regras_quebra_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exame_original TEXT NOT NULL,
  exame_quebrado TEXT NOT NULL,
  categoria_quebrada TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_regras_quebra_exame_original ON public.regras_quebra_exames(exame_original);
CREATE INDEX idx_regras_quebra_ativo ON public.regras_quebra_exames(ativo);

-- RLS
ALTER TABLE public.regras_quebra_exames ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admins podem gerenciar regras quebra" 
ON public.regras_quebra_exames 
FOR ALL 
TO authenticated 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver regras quebra" 
ON public.regras_quebra_exames 
FOR SELECT 
TO authenticated 
USING (is_manager_or_admin());

-- Trigger para updated_at
CREATE TRIGGER update_regras_quebra_exames_updated_at
  BEFORE UPDATE ON public.regras_quebra_exames
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();