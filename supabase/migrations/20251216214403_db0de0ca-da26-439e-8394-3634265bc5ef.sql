
-- Otimização de performance RLS na tabela profiles
-- Substituir auth.uid() por (select auth.uid()) para cache do planejador

-- 1. SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- 2. INSERT policy  
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()));

-- 3. UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()));

-- 4. Garantir índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
