-- Criar tabela de exames/laudos
CREATE TABLE public.exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  paciente_nome TEXT NOT NULL,
  data_exame DATE NOT NULL,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'realizado',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

-- Create policies for exames
CREATE POLICY "Admins podem gerenciar todos os exames" 
ON public.exames 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver todos os exames" 
ON public.exames 
FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Médicos podem ver seus próprios exames" 
ON public.exames 
FOR SELECT 
USING (medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()));

-- Proteção temporal para exames
CREATE POLICY "Proteção temporal - SELECT exames" 
ON public.exames 
FOR SELECT 
USING (can_view_data(data_exame) AND (is_manager_or_admin() OR (medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()))));

CREATE POLICY "Proteção temporal - INSERT exames" 
ON public.exames 
FOR INSERT 
WITH CHECK (can_insert_data(data_exame) AND is_manager_or_admin());

CREATE POLICY "Proteção temporal - UPDATE exames" 
ON public.exames 
FOR UPDATE 
USING (can_edit_data(data_exame) AND is_manager_or_admin())
WITH CHECK (can_edit_data(data_exame) AND is_manager_or_admin());

CREATE POLICY "Proteção temporal - DELETE exames" 
ON public.exames 
FOR DELETE 
USING (can_edit_data(data_exame) AND is_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_exames_updated_at
BEFORE UPDATE ON public.exames
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de pagamentos médicos
CREATE TABLE public.pagamentos_medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_exames INTEGER NOT NULL DEFAULT 0,
  valor_bruto NUMERIC(10,2) NOT NULL DEFAULT 0,
  descontos NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento DATE,
  observacoes TEXT,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pagamentos_medicos ENABLE ROW LEVEL SECURITY;

-- Create policies for pagamentos_medicos
CREATE POLICY "Admins podem gerenciar pagamentos médicos" 
ON public.pagamentos_medicos 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver pagamentos médicos" 
ON public.pagamentos_medicos 
FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Médicos podem ver seus próprios pagamentos" 
ON public.pagamentos_medicos 
FOR SELECT 
USING (medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pagamentos_medicos_updated_at
BEFORE UPDATE ON public.pagamentos_medicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();