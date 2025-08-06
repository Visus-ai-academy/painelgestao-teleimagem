-- 🔐 CORREÇÕES DE SEGURANÇA PRIORITÁRIAS

-- 1. Corrigir search_path em funções críticas (amostras principais)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'manager')
  );
END;
$$;

-- 2. Criar trigger para profiles automáticos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- 3. Ativar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Criar índices de performance essenciais
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clientes_ativo_nome ON clientes(ativo, nome) WHERE ativo = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_volumetria_empresa_data ON volumetria_mobilemed("EMPRESA", data_referencia);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_precos_cliente_ativo ON precos_servicos(cliente_id, ativo) WHERE ativo = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_escalas_medico_data ON escalas_medicas(medico_id, data);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_faturamento_cliente_periodo ON faturamento(cliente_id, periodo_referencia);

-- 5. Otimizar consultas com índices compostos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_performance ON audit_logs(table_name, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_upload_logs_status_created ON upload_logs(status, created_at DESC);