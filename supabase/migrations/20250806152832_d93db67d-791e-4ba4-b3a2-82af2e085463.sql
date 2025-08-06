-- FINAL SECURITY FIXES - DROP AND RECREATE FUNCTION
-- =================================================================
-- DROP AND RECREATE THE PROBLEMATIC FUNCTION
-- =================================================================

DROP FUNCTION IF EXISTS public.validate_security_configuration();

CREATE OR REPLACE FUNCTION public.validate_security_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  rls_enabled_count integer;
  functions_with_search_path integer;
  permissive_policies_count integer;
BEGIN
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND rowsecurity = true;
  
  -- Count functions with proper search_path
  SELECT COUNT(*) INTO functions_with_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proconfig @> ARRAY['search_path=public'];
  
  -- Count potentially permissive policies (using 'true' condition)
  SELECT COUNT(*) INTO permissive_policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true');
  
  result := jsonb_build_object(
    'rls_enabled_tables', rls_enabled_count,
    'secure_functions', functions_with_search_path,
    'permissive_policies', permissive_policies_count,
    'security_score', CASE 
      WHEN permissive_policies_count = 0 AND rls_enabled_count > 10 
        THEN 9
      WHEN permissive_policies_count <= 2 AND rls_enabled_count > 5 
        THEN 7
      ELSE 5
    END,
    'timestamp', now(),
    'recommendations', CASE
      WHEN permissive_policies_count > 0 
        THEN jsonb_build_array('Review and restrict permissive RLS policies')
      ELSE jsonb_build_array('Security configuration looks good')
    END
  );
  
  RETURN result;
END;
$$;

-- =================================================================
-- RUN FINAL SECURITY VALIDATION
-- =================================================================

-- Get the final security status
SELECT validate_security_configuration();