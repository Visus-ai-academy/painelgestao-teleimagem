-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cnpj TEXT,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exams table
CREATE TABLE public.exames_realizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  medico TEXT NOT NULL,
  data_exame DATE NOT NULL,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT,
  prioridade TEXT,
  status TEXT DEFAULT 'realizado',
  valor_bruto DECIMAL(10,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contracts table
CREATE TABLE public.contratos_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT,
  prioridade TEXT,
  valor DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(5,2) DEFAULT 0,
  acrescimo DECIMAL(5,2) DEFAULT 0,
  data_vigencia_inicio DATE NOT NULL,
  data_vigencia_fim DATE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.faturas_geradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  periodo TEXT NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'paga', 'cancelada')),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto DECIMAL(12,2) DEFAULT 0,
  acrescimo DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  arquivo_pdf TEXT,
  email_enviado BOOLEAN DEFAULT false,
  data_email TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice items table
CREATE TABLE public.fatura_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID REFERENCES public.faturas_geradas(id) ON DELETE CASCADE NOT NULL,
  exame_id UUID REFERENCES public.exames_realizados(id),
  descricao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create upload logs table
CREATE TABLE public.upload_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exames_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas_geradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = $1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role(auth.uid()) = 'admin';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Clients policies  
CREATE POLICY "Authenticated users can view clients" ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create clients" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients" ON public.clientes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete clients" ON public.clientes
  FOR DELETE TO authenticated USING (public.is_admin());

-- Exams policies
CREATE POLICY "Authenticated users can view exams" ON public.exames_realizados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create exams" ON public.exames_realizados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update exams" ON public.exames_realizados
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete exams" ON public.exames_realizados
  FOR DELETE TO authenticated USING (public.is_admin());

-- Contracts policies
CREATE POLICY "Authenticated users can view contracts" ON public.contratos_clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create contracts" ON public.contratos_clientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contracts" ON public.contratos_clientes
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete contracts" ON public.contratos_clientes
  FOR DELETE TO authenticated USING (public.is_admin());

-- Invoices policies
CREATE POLICY "Authenticated users can view invoices" ON public.faturas_geradas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create invoices" ON public.faturas_geradas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices" ON public.faturas_geradas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete invoices" ON public.faturas_geradas
  FOR DELETE TO authenticated USING (public.is_admin());

-- Invoice items policies
CREATE POLICY "Authenticated users can view invoice items" ON public.fatura_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create invoice items" ON public.fatura_itens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice items" ON public.fatura_itens
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete invoice items" ON public.fatura_itens
  FOR DELETE TO authenticated USING (true);

-- Upload logs policies
CREATE POLICY "Users can view own uploads" ON public.upload_logs
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Users can create uploads" ON public.upload_logs
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can view all uploads" ON public.upload_logs
  FOR ALL USING (public.is_admin());

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exames_updated_at
  BEFORE UPDATE ON public.exames_realizados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratos_updated_at
  BEFORE UPDATE ON public.contratos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faturas_updated_at
  BEFORE UPDATE ON public.faturas_geradas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_upload_logs_updated_at
  BEFORE UPDATE ON public.upload_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

-- Storage policies for uploads
CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can view own uploads" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can delete own uploads" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'uploads');

-- Create indices for better performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_clientes_nome ON public.clientes(nome);
CREATE INDEX idx_exames_cliente_id ON public.exames_realizados(cliente_id);
CREATE INDEX idx_exames_data ON public.exames_realizados(data_exame);
CREATE INDEX idx_contratos_cliente_id ON public.contratos_clientes(cliente_id);
CREATE INDEX idx_faturas_cliente_id ON public.faturas_geradas(cliente_id);
CREATE INDEX idx_faturas_numero ON public.faturas_geradas(numero);
CREATE INDEX idx_fatura_itens_fatura_id ON public.fatura_itens(fatura_id);