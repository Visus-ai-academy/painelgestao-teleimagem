-- Excluir a tabela omie_faturas
DROP TABLE IF EXISTS public.omie_faturas;

-- Criar nova tabela faturamento baseada no arquivo de upload
CREATE TABLE public.faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL, -- coluna B (nome do cliente)
  email TEXT, -- será preenchido via JOIN com clientes
  quantidade INTEGER NOT NULL DEFAULT 1, -- coluna J
  valor_bruto NUMERIC NOT NULL DEFAULT 0, -- coluna K  
  data_emissao DATE NOT NULL,
  numero_fatura TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  periodo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.faturamento ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "Authenticated users can view faturamento" 
ON public.faturamento 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create faturamento" 
ON public.faturamento 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update faturamento" 
ON public.faturamento 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete faturamento" 
ON public.faturamento 
FOR DELETE 
USING (is_admin());

-- Criar trigger para updated_at
CREATE TRIGGER update_faturamento_updated_at
BEFORE UPDATE ON public.faturamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();