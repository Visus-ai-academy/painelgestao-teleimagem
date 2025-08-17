-- SECURITY ENHANCEMENT: Add admin role check function for critical operations
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = is_admin.user_id 
    AND ur.role = 'admin'::app_role
  );
$$;

-- SECURITY ENHANCEMENT: Add manager or admin check function  
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = is_manager_or_admin.user_id 
    AND ur.role = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  );
$$;

-- SECURITY ENHANCEMENT: Add data access logging function
CREATE OR REPLACE FUNCTION public.log_data_access(
  resource_type text,
  resource_id text,
  action text,
  sensitive_data boolean DEFAULT false,
  classification text DEFAULT 'public'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO data_access_logs (
    user_id,
    user_email,
    resource_type,
    resource_id,
    action,
    sensitive_data_accessed,
    data_classification,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'unknown'),
    resource_type,
    resource_id,
    action,
    sensitive_data,
    classification,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$;

-- SECURITY ENHANCEMENT: Add audit logging function
CREATE OR REPLACE FUNCTION public.log_audit_event(
  table_name text,
  operation text,
  record_id text,
  old_data jsonb DEFAULT NULL,
  new_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    operation,
    record_id,
    old_data,
    new_data,
    user_id,
    user_email,
    severity,
    ip_address
  ) VALUES (
    table_name,
    operation,
    record_id,
    old_data,
    new_data,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    CASE 
      WHEN operation IN ('DELETE', 'SECURITY_BREACH', 'UNAUTHORIZED_ACCESS') THEN 'critical'
      WHEN operation IN ('UPDATE', 'INSERT') THEN 'warning'
      ELSE 'info'
    END,
    inet_client_addr()
  );
END;
$$;