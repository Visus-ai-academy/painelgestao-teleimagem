-- Deletar a função existente com a assinatura correta
DROP FUNCTION IF EXISTS public.log_rejeicao_registro(p_dados_originais jsonb, p_motivo_rejeicao text, p_detalhes_erro text, p_arquivo_fonte text, p_lote_upload text);

-- Criar a nova função
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não falha o trigger
    RAISE NOTICE 'Erro ao inserir registro rejeitado: %', SQLERRM;
END;
$$;

-- Configurar políticas RLS
DROP POLICY IF EXISTS "Sistema pode inserir registros rejeitados" ON registros_rejeitados_processamento;
DROP POLICY IF EXISTS "Usuários podem ver registros rejeitados" ON registros_rejeitados_processamento;

CREATE POLICY "Sistema pode inserir registros rejeitados"
  ON registros_rejeitados_processamento
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem ver registros rejeitados"
  ON registros_rejeitados_processamento
  FOR SELECT
  TO authenticated
  USING (true);