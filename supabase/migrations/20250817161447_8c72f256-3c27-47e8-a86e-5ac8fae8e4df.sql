-- SECURITY FIX: Remove overly permissive policy that exposes medical data
-- This policy allowed ANY authenticated user to see all patient medical data
DROP POLICY IF EXISTS "Usuários autenticados podem ver volumetria básica" ON public.volumetria_mobilemed;

-- Ensure we have proper restrictive access controls:
-- 1. Admins can do everything (already exists)
-- 2. Managers can view data (already exists) 
-- 3. Users can only view data for companies they have access to (already exists)

-- Log this critical security fix
INSERT INTO public.audit_logs (
    table_name, 
    operation, 
    record_id, 
    new_data, 
    user_email, 
    severity
) VALUES (
    'volumetria_mobilemed',
    'SECURITY_FIX_POLICY_REMOVED',
    'public_access_policy',
    jsonb_build_object(
        'removed_policy', 'Usuários autenticados podem ver volumetria básica',
        'reason', 'Exposed sensitive medical data to any authenticated user',
        'remaining_policies', 'Admin/Manager/Company-specific access only'
    ),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    'critical'
);