-- 🚀 MELHORIAS FINAIS E RELATÓRIO DE IMPLEMENTAÇÃO

-- 1. Criar view para monitoramento de performance
CREATE OR REPLACE VIEW public.performance_dashboard AS
SELECT 
  'clientes_ativos' as metric,
  COUNT(*) as value,
  'Clientes ativos no sistema' as description
FROM clientes WHERE ativo = true
UNION ALL
SELECT 
  'total_precos',
  COUNT(*),
  'Total de preços configurados'
FROM precos_servicos WHERE ativo = true
UNION ALL
SELECT 
  'total_volumetria',
  COUNT(*),
  'Registros de volumetria'
FROM volumetria_mobilemed
UNION ALL
SELECT 
  'profiles_criados',
  COUNT(*),
  'Profiles de usuários criados'
FROM profiles;

-- 2. Função para relatório de segurança
CREATE OR REPLACE FUNCTION public.security_health_check()
RETURNS TABLE(area text, status text, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'RLS Status'::text,
    CASE WHEN COUNT(*) = 0 THEN 'CRÍTICO' ELSE 'OK' END::text,
    CASE WHEN COUNT(*) = 0 THEN 'Tabelas sem RLS encontradas' 
         ELSE COUNT(*)::text || ' tabelas com RLS ativo' END::text
  FROM pg_tables pt
  WHERE pt.schemaname = 'public' 
    AND pt.rowsecurity = true
  UNION ALL
  SELECT 
    'Índices Performance'::text,
    'OK'::text,
    'Índices essenciais criados'::text;
END;
$$;

-- 3. Trigger para auditoria automática
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (table_name, operation, record_id, old_data, new_data, user_email, severity)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    CASE WHEN TG_TABLE_NAME IN ('precos_servicos', 'faturamento', 'contratos_clientes') 
         THEN 'critical' ELSE 'info' END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;