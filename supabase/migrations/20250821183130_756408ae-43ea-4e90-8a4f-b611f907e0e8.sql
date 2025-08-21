-- Corrigir RLS para audit_logs permitir inserções do sistema
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON audit_logs;

CREATE POLICY "Sistema pode inserir logs" 
ON audit_logs 
FOR INSERT 
TO service_role, authenticator
WITH CHECK (true);

-- Permitir também inserções de usuários autenticados
CREATE POLICY "Usuários autenticados podem inserir logs"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_email IS NOT NULL);

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

-- RLS para registros rejeitados
ALTER TABLE registros_rejeitados_processamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver registros rejeitados"
ON registros_rejeitados_processamento
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Sistema pode inserir registros rejeitados"
ON registros_rejeitados_processamento
FOR INSERT
TO service_role, authenticator
WITH CHECK (true);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_arquivo_fonte 
ON registros_rejeitados_processamento (arquivo_fonte);

CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_lote 
ON registros_rejeitados_processamento (lote_upload);

CREATE INDEX IF NOT EXISTS idx_registros_rejeitados_created_at 
ON registros_rejeitados_processamento (created_at);

-- Função para resumir validações de integridade aplicadas
CREATE OR REPLACE FUNCTION get_resumo_validacoes_integridade()
RETURNS TABLE(
  validacao TEXT,
  descricao TEXT,
  total_rejeitados BIGINT,
  ultima_ocorrencia TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rrp.motivo_rejeicao as validacao,
    CASE 
      WHEN rrp.motivo_rejeicao = 'campos_obrigatorios_vazios' THEN 'Campos EMPRESA ou NOME_PACIENTE vazios/nulos'
      WHEN rrp.motivo_rejeicao = 'data_invalida' THEN 'Datas em formato inválido ou inconsistente'
      WHEN rrp.motivo_rejeicao = 'regra_v031_periodo' THEN 'DATA_LAUDO fora do período de faturamento (v031)'
      WHEN rrp.motivo_rejeicao = 'regra_v032_cliente_especifico' THEN 'Cliente na lista de exclusão (RADIOCOR_LOCAL, etc)'
      ELSE rrp.motivo_rejeicao
    END as descricao,
    COUNT(*) as total_rejeitados,
    MAX(rrp.created_at) as ultima_ocorrencia
  FROM registros_rejeitados_processamento rrp
  WHERE rrp.created_at > now() - interval '7 days'
  GROUP BY rrp.motivo_rejeicao
  ORDER BY COUNT(*) DESC;
END;
$$;