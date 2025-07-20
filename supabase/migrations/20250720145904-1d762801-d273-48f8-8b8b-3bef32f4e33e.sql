-- Sistema de Auditoria e Logs de Segurança

-- Tabela de auditoria para rastrear todas as alterações
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  session_id TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- Tabela de logs de acesso a dados sensíveis
CREATE TABLE public.data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sensitive_data_accessed BOOLEAN DEFAULT FALSE,
  data_classification TEXT DEFAULT 'public' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted'))
);

-- Tabela de alertas de segurança
CREATE TABLE public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  metadata JSONB,
  auto_resolved BOOLEAN DEFAULT FALSE
);

-- Tabela de tentativas de login
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent TEXT,
  country TEXT,
  city TEXT
);

-- Tabela para 2FA
CREATE TABLE public.user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  backup_codes TEXT[],
  enabled BOOLEAN DEFAULT FALSE,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de políticas de senha
CREATE TABLE public.password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_length INTEGER DEFAULT 12,
  require_uppercase BOOLEAN DEFAULT TRUE,
  require_lowercase BOOLEAN DEFAULT TRUE,
  require_numbers BOOLEAN DEFAULT TRUE,
  require_symbols BOOLEAN DEFAULT TRUE,
  max_age_days INTEGER DEFAULT 90,
  history_count INTEGER DEFAULT 5,
  max_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir política padrão
INSERT INTO public.password_policies DEFAULT VALUES;

-- Tabela de dados criptografados
CREATE TABLE public.encrypted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  hash_value TEXT,
  encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(record_id, table_name, field_name)
);

-- Tabela de consentimento LGPD
CREATE TABLE public.lgpd_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  legal_basis TEXT NOT NULL
);

-- Tabela de retenção de dados
CREATE TABLE public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  retention_period_days INTEGER NOT NULL,
  auto_delete BOOLEAN DEFAULT FALSE,
  legal_hold BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Políticas de retenção padrão
INSERT INTO public.data_retention_policies (table_name, retention_period_days, auto_delete) VALUES
('audit_logs', 2555, TRUE), -- 7 anos
('data_access_logs', 1095, TRUE), -- 3 anos
('login_attempts', 365, TRUE), -- 1 ano
('security_alerts', 1095, FALSE), -- 3 anos, não deletar automaticamente
('lgpd_consent', 1825, FALSE); -- 5 anos

-- Tabela de backup logs
CREATE TABLE public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  file_size_bytes BIGINT,
  backup_location TEXT,
  error_message TEXT,
  checksum TEXT
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auditoria (só admins)
CREATE POLICY "Admins podem ver logs de auditoria" ON public.audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins podem ver logs de acesso" ON public.data_access_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins podem gerenciar alertas" ON public.security_alerts FOR ALL USING (is_admin());
CREATE POLICY "Admins podem ver tentativas de login" ON public.login_attempts FOR ALL USING (is_admin());
CREATE POLICY "Admins podem gerenciar políticas de senha" ON public.password_policies FOR ALL USING (is_admin());
CREATE POLICY "Admins podem ver dados criptografados" ON public.encrypted_data FOR SELECT USING (is_admin());
CREATE POLICY "Admins podem ver políticas de retenção" ON public.data_retention_policies FOR ALL USING (is_admin());
CREATE POLICY "Admins podem ver logs de backup" ON public.backup_logs FOR ALL USING (is_admin());

-- Usuários podem ver seus próprios dados 2FA e consentimentos
CREATE POLICY "Usuários podem gerenciar seu 2FA" ON public.user_2fa FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Usuários podem ver seus consentimentos" ON public.lgpd_consent FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Sistema pode inserir consentimentos" ON public.lgpd_consent FOR INSERT WITH CHECK (TRUE);

-- Função para log de auditoria
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    table_name, operation, record_id, old_data, new_data, 
    user_id, user_email, severity, session_id
  ) VALUES (
    p_table_name, p_operation, p_record_id, p_old_data, p_new_data,
    auth.uid(), 
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
    p_severity,
    COALESCE(current_setting('app.session_id', true), gen_random_uuid()::text)
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;

-- Função para log de acesso a dados sensíveis
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'SELECT',
  p_sensitive BOOLEAN DEFAULT FALSE,
  p_classification TEXT DEFAULT 'public'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.data_access_logs (
    user_id, user_email, resource_type, resource_id, action,
    sensitive_data_accessed, data_classification
  ) VALUES (
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'anonymous'),
    p_resource_type, p_resource_id, p_action, p_sensitive, p_classification
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Função para criar alerta de segurança
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_alert_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO public.security_alerts (
    alert_type, severity, title, description, user_id, metadata
  ) VALUES (
    p_alert_type, p_severity, p_title, p_description, auth.uid(), p_metadata
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$;

-- Função para validar CPF
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
BEGIN
  -- Remove formatação
  digits := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  -- Verifica se tem 11 dígitos
  IF length(digits) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica sequências inválidas
  IF digits ~ '^(.)\1{10}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula primeiro dígito verificador
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(digits, i, 1)::INTEGER * (11 - i));
  END LOOP;
  
  sum1 := ((sum1 * 10) % 11);
  IF sum1 = 10 THEN sum1 := 0; END IF;
  
  -- Verifica primeiro dígito
  IF sum1 != substring(digits, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula segundo dígito verificador
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(digits, i, 1)::INTEGER * (12 - i));
  END LOOP;
  
  sum2 := ((sum2 * 10) % 11);
  IF sum2 = 10 THEN sum2 := 0; END IF;
  
  -- Verifica segundo dígito
  RETURN sum2 = substring(digits, 11, 1)::INTEGER;
END;
$$;

-- Função para validar CNPJ
CREATE OR REPLACE FUNCTION public.validate_cnpj(cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  i INTEGER;
  weight1 INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  weight2 INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
BEGIN
  -- Remove formatação
  digits := regexp_replace(cnpj, '[^0-9]', '', 'g');
  
  -- Verifica se tem 14 dígitos
  IF length(digits) != 14 THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica sequências inválidas
  IF digits ~ '^(.)\1{13}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula primeiro dígito verificador
  FOR i IN 1..12 LOOP
    sum1 := sum1 + (substring(digits, i, 1)::INTEGER * weight1[i]);
  END LOOP;
  
  sum1 := sum1 % 11;
  IF sum1 < 2 THEN sum1 := 0; ELSE sum1 := 11 - sum1; END IF;
  
  -- Verifica primeiro dígito
  IF sum1 != substring(digits, 13, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula segundo dígito verificador
  FOR i IN 1..13 LOOP
    sum2 := sum2 + (substring(digits, i, 1)::INTEGER * weight2[i]);
  END LOOP;
  
  sum2 := sum2 % 11;
  IF sum2 < 2 THEN sum2 := 0; ELSE sum2 := 11 - sum2; END IF;
  
  -- Verifica segundo dígito
  RETURN sum2 = substring(digits, 14, 1)::INTEGER;
END;
$$;

-- Função para hash de dados pessoais
CREATE OR REPLACE FUNCTION public.hash_personal_data(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Utiliza digest do pgcrypto para hash SHA-256
  RETURN encode(digest(data, 'sha256'), 'hex');
END;
$$;

-- Triggers para auditoria automática em tabelas principais
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME, 'DELETE', OLD.id::TEXT, row_to_json(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME, 'UPDATE', NEW.id::TEXT, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME, 'INSERT', NEW.id::TEXT, NULL, row_to_json(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Aplicar triggers de auditoria em tabelas principais
CREATE TRIGGER audit_clientes AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_medicos AFTER INSERT OR UPDATE OR DELETE ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_exames AFTER INSERT OR UPDATE OR DELETE ON public.exames
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_faturamento AFTER INSERT OR UPDATE OR DELETE ON public.faturamento
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Índices para performance
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX idx_audit_logs_table_operation ON public.audit_logs(table_name, operation);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_data_access_logs_user_timestamp ON public.data_access_logs(user_id, timestamp);
CREATE INDEX idx_security_alerts_severity_status ON public.security_alerts(severity, status);
CREATE INDEX idx_login_attempts_email_timestamp ON public.login_attempts(email, timestamp);
CREATE INDEX idx_encrypted_data_lookup ON public.encrypted_data(record_id, table_name, field_name);