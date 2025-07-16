-- Script para promover o primeiro usuário registrado a administrador
-- Este script deve ser executado após o primeiro usuário se registrar

-- Função para promover usuário a admin (apenas para ser usada manualmente)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Buscar o user_id baseado no email
    SELECT user_id INTO target_user_id
    FROM public.profiles
    WHERE email = user_email
    LIMIT 1;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário com email % não encontrado', user_email;
    END IF;
    
    -- Remover roles existentes
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
    -- Adicionar role de admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::app_role);
    
    RETURN TRUE;
END;
$$;

-- Comentário: Para promover um usuário a admin, execute:
-- SELECT public.promote_user_to_admin('email@exemplo.com');