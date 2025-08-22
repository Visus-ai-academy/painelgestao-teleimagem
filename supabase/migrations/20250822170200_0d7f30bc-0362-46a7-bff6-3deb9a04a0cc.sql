-- Criar a função log_rejeicao_registro simples
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
    1,
    dados_registro,
    motivo_rejeicao,
    detalhes_erro,
    now()
  );
END;
$$;

-- Configurar políticas RLS simples
DROP POLICY IF EXISTS "Sistema pode inserir registros rejeitados" ON registros_rejeitados_processamento;
DROP POLICY IF EXISTS "Usuários podem ver registros rejeitados" ON registros_rejeitados_processamento;

-- Política simples para permitir inserção pelo sistema
CREATE POLICY "Sistema pode inserir registros rejeitados"
  ON registros_rejeitados_processamento
  FOR INSERT
  WITH CHECK (true);

-- Política simples para visualização por usuários autenticados
CREATE POLICY "Usuários podem ver registros rejeitados"
  ON registros_rejeitados_processamento
  FOR SELECT
  TO authenticated
  USING (true);