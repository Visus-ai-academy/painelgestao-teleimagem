-- Corrigir RLS para audit_logs permitir inserções do sistema
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON audit_logs;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir logs" ON audit_logs;

CREATE POLICY "Sistema pode inserir logs" 
ON audit_logs 
FOR INSERT 
TO service_role, authenticator
WITH CHECK (true);

-- Criar tabela para rastrear registros rejeitados durante processamento
CREATE TABLE IF NOT EXISTS registros_rejeitados_processamento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo_fonte TEXT NOT NULL,
  lote_upload TEXT,
  linha_original INTEGER,
  dados_originais JSONB,
  motivo_rejeicao TEXT NOT NULL,
  detalhes_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para registros rejeitados (sem usar is_admin para evitar conflito)
ALTER TABLE registros_rejeitados_processamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver registros rejeitados"
ON registros_rejeitados_processamento
FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
));

CREATE POLICY "Sistema pode inserir registros rejeitados"
ON registros_rejeitados_processamento
FOR INSERT
TO service_role, authenticator
WITH CHECK (true);