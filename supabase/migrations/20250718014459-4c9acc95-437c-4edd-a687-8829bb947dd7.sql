-- Criar tabelas para modalidades, especialidades, categorias e prioridades
CREATE TABLE IF NOT EXISTS public.modalidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.especialidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.categorias_exame (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.prioridades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.categorias_medico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Inserir dados iniciais nas modalidades
INSERT INTO public.modalidades (nome, ordem) VALUES
('Radiologia Simples', 1),
('Tomografia Computadorizada', 2),
('Ressonância Magnética', 3),
('Ultrassonografia', 4),
('Mamografia', 5),
('Densitometria Óssea', 6),
('Ecocardiograma', 7),
('Eletrocardiograma', 8),
('Holter 24h', 9),
('MAPA', 10),
('Endoscopia', 11),
('Colonoscopia', 12)
ON CONFLICT (nome) DO NOTHING;

-- Inserir dados iniciais nas especialidades
INSERT INTO public.especialidades (nome, ordem) VALUES
('Radiologia e Diagnóstico por Imagem', 1),
('Cardiologia', 2),
('Neurologia', 3),
('Ortopedia', 4),
('Ginecologia', 5),
('Urologia', 6),
('Gastroenterologia', 7),
('Pneumologia', 8),
('Pediatria', 9),
('Medicina Nuclear', 10)
ON CONFLICT (nome) DO NOTHING;

-- Inserir dados iniciais nas categorias de exame
INSERT INTO public.categorias_exame (nome, ordem) VALUES
('Simples', 1),
('Complexo', 2),
('Intervencionista', 3),
('Contrastado', 4),
('Funcional', 5),
('Dinâmico', 6)
ON CONFLICT (nome) DO NOTHING;

-- Inserir dados iniciais nas prioridades
INSERT INTO public.prioridades (nome, ordem) VALUES
('Normal', 1),
('Urgente', 2),
('Emergência', 3)
ON CONFLICT (nome) DO NOTHING;

-- Inserir dados iniciais nas categorias de médico
INSERT INTO public.categorias_medico (nome, ordem) VALUES
('Radiologista Pleno', 1),
('Radiologista Sênior', 2),
('Cardiologista', 3),
('Clínico Geral', 4),
('Especialista', 5)
ON CONFLICT (nome) DO NOTHING;

-- Habilitar RLS nas tabelas
ALTER TABLE public.modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_exame ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_medico ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Todos podem visualizar modalidades ativas"
ON public.modalidades
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar modalidades"
ON public.modalidades
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Todos podem visualizar especialidades ativas"
ON public.especialidades
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar especialidades"
ON public.especialidades
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Todos podem visualizar categorias exame ativas"
ON public.categorias_exame
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar categorias exame"
ON public.categorias_exame
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Todos podem visualizar prioridades ativas"
ON public.prioridades
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar prioridades"
ON public.prioridades
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Todos podem visualizar categorias médico ativas"
ON public.categorias_medico
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins podem gerenciar categorias médico"
ON public.categorias_medico
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Triggers para updated_at
CREATE TRIGGER update_modalidades_updated_at
  BEFORE UPDATE ON public.modalidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_especialidades_updated_at
  BEFORE UPDATE ON public.especialidades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categorias_exame_updated_at
  BEFORE UPDATE ON public.categorias_exame
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prioridades_updated_at
  BEFORE UPDATE ON public.prioridades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categorias_medico_updated_at
  BEFORE UPDATE ON public.categorias_medico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();