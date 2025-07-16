-- Primeiro, vamos usar CASCADE para remover as dependências
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Recriar function get_user_role se necessário
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE user_id = $1;
$$;

-- Criar enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Criar tabela de roles de usuários
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar roles (evita problemas de RLS recursivo)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se é admin (nova versão)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
$$;

-- Função para verificar se é manager ou admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role) 
      OR public.has_role(_user_id, 'manager'::app_role)
$$;

-- Políticas RLS para user_roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Trigger para criar role padrão quando um novo usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Recriar as políticas que foram removidas
-- Políticas para profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR ALL
TO authenticated
USING (public.is_admin());

-- Políticas para clientes
CREATE POLICY "Admins can delete clients" 
ON public.clientes 
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas para exames_realizados
CREATE POLICY "Admins can delete exams" 
ON public.exames_realizados 
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas para contratos_clientes
CREATE POLICY "Admins can delete contracts" 
ON public.contratos_clientes 
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas para faturas_geradas
CREATE POLICY "Admins can delete invoices" 
ON public.faturas_geradas 
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas para upload_logs
CREATE POLICY "Admins can view all uploads" 
ON public.upload_logs 
FOR ALL
TO authenticated
USING (public.is_admin());