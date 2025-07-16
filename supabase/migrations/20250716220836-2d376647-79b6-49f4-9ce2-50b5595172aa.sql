-- Criar tabela para permissões customizadas de menu por usuário
CREATE TABLE public.user_menu_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  menu_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_key)
);

-- Habilitar RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem gerenciar permissões
CREATE POLICY "Admins can view all menu permissions" 
ON public.user_menu_permissions 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can insert menu permissions" 
ON public.user_menu_permissions 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update menu permissions" 
ON public.user_menu_permissions 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete menu permissions" 
ON public.user_menu_permissions 
FOR DELETE 
USING (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_menu_permissions_updated_at
BEFORE UPDATE ON public.user_menu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();