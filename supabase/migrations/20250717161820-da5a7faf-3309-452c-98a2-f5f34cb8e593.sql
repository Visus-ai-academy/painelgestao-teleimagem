-- Criar tabela medicos
CREATE TABLE public.medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  crm TEXT NOT NULL UNIQUE,
  especialidade TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela escalas_medicas
CREATE TABLE public.escalas_medicas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manha', 'tarde', 'noite', 'plantao')),
  tipo_escala TEXT NOT NULL CHECK (tipo_escala IN ('normal', 'plantao', 'extra', 'backup')),
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'pendente', 'ausencia', 'cancelada')),
  observacoes TEXT,
  motivo_ausencia TEXT,
  data_ausencia TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas_medicas ENABLE ROW LEVEL SECURITY;

-- Políticas para tabela medicos
CREATE POLICY "Admins e managers podem ver todos os médicos" 
ON public.medicos 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Médicos podem ver seu próprio perfil" 
ON public.medicos 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins podem gerenciar médicos" 
ON public.medicos 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Políticas para tabela escalas_medicas
CREATE POLICY "Médicos podem ver apenas suas escalas" 
ON public.escalas_medicas 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'medico'::app_role) AND 
  medico_id IN (SELECT id FROM public.medicos WHERE user_id = auth.uid())
);

CREATE POLICY "Admins e managers podem ver todas as escalas" 
ON public.escalas_medicas 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Médicos podem informar ausência" 
ON public.escalas_medicas 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'medico'::app_role) AND 
  medico_id IN (SELECT id FROM public.medicos WHERE user_id = auth.uid())
)
WITH CHECK (
  medico_id IN (SELECT id FROM public.medicos WHERE user_id = auth.uid())
);

CREATE POLICY "Admins e managers podem gerenciar escalas" 
ON public.escalas_medicas 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Triggers para updated_at
CREATE TRIGGER update_medicos_updated_at
  BEFORE UPDATE ON public.medicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_escalas_medicas_updated_at
  BEFORE UPDATE ON public.escalas_medicas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_escalas_medicas_medico_data ON public.escalas_medicas(medico_id, data);
CREATE INDEX idx_escalas_medicas_data_turno ON public.escalas_medicas(data, turno);
CREATE INDEX idx_escalas_medicas_status ON public.escalas_medicas(status);
CREATE INDEX idx_medicos_user_id ON public.medicos(user_id);
CREATE INDEX idx_medicos_especialidade ON public.medicos(especialidade);