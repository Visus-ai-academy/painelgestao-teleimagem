-- Adicionar role de admin para o usuário principal
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'adm@medforlife.com.br'
ON CONFLICT (user_id, role) DO NOTHING;