-- Primeiro, vamos dropar a função existente com a assinatura correta
DROP FUNCTION IF EXISTS public.log_rejeicao_registro(jsonb,text,text,text,text);

-- Agora criar a função correta
CREATE OR REPLACE FUNCTION public.log_rejeicao_registro(
  dados_registro jsonb,
  motivo_rejeicao text,
  detalhes_erro text,
  arquivo_fonte text DEFAULT 'unknown',
  lote_upload text DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO registros_rejeitados_processamento (
    arquivo_fonte,
    lote_upload,
    linha_original,
    dados_originais,
    motivo_rejeicao,
    detalhes_erro,
    created_at
  ) VALUES (
    arquivo_fonte,
    lote_upload,
    1, -- Número fixo já que não temos linha original
    dados_registro,
    motivo_rejeicao,
    detalhes_erro,
    now()
  );
END;
$$;

-- Configurar políticas RLS corretas
DROP POLICY IF EXISTS "Admins podem gerenciar registros rejeitados" ON registros_rejeitados_processamento;
DROP POLICY IF EXISTS "Managers podem ver registros rejeitados" ON registros_rejeitados_processamento;
DROP POLICY IF EXISTS "Sistema pode inserir registros rejeitados" ON registros_rejeitados_processamento;

CREATE POLICY "Sistema pode inserir registros rejeitados"
  ON registros_rejeitados_processamento
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Managers podem ver registros rejeitados"
  ON registros_rejeitados_processamento
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin());

CREATE POLICY "Admins podem gerenciar registros rejeitados"
  ON registros_rejeitados_processamento
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());