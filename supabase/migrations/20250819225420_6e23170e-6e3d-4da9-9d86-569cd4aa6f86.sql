-- CORREÇÃO 3: Criar tabela para controle de integridade
CREATE TABLE IF NOT EXISTS public.validacao_integridade (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid NOT NULL,
  arquivo_fonte text NOT NULL,
  validacoes_executadas jsonb DEFAULT '{}'::jsonb,
  validacoes_aprovadas jsonb DEFAULT '{}'::jsonb,
  validacoes_falhadas jsonb DEFAULT '{}'::jsonb,
  pontuacao_integridade numeric DEFAULT 0,
  status_geral text NOT NULL DEFAULT 'pendente'::text,
  requer_rollback boolean DEFAULT false,
  executado_em timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.validacao_integridade ENABLE ROW LEVEL SECURITY;

-- Política para admins (especificando o tipo uuid explicitamente)
CREATE POLICY "Admins podem gerenciar integridade" 
ON public.validacao_integridade 
FOR ALL 
USING (public.is_admin(auth.uid()::uuid)) 
WITH CHECK (public.is_admin(auth.uid()::uuid));

-- CORREÇÃO 4: Função para rollback de processamento
CREATE OR REPLACE FUNCTION public.executar_rollback_upload(p_upload_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  upload_info RECORD;
  registros_removidos INTEGER := 0;
  resultado jsonb;
BEGIN
  -- Buscar informações do upload
  SELECT * INTO upload_info
  FROM processamento_uploads
  WHERE id = p_upload_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Upload não encontrado');
  END IF;
  
  -- Remover dados da volumetria_mobilemed relacionados a este upload
  DELETE FROM volumetria_mobilemed 
  WHERE lote_upload = (upload_info.detalhes_erro->>'lote_upload');
  
  GET DIAGNOSTICS registros_removidos = ROW_COUNT;
  
  -- Atualizar status do upload
  UPDATE processamento_uploads
  SET status = 'rollback_executado',
      detalhes_erro = jsonb_build_object(
        'motivo_rollback', p_motivo,
        'registros_removidos', registros_removidos,
        'executado_em', now()
      ),
      updated_at = now()
  WHERE id = p_upload_id;
  
  -- Registrar no log de auditoria
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('processamento_uploads', 'ROLLBACK', p_upload_id::text, 
          jsonb_build_object('motivo', p_motivo, 'registros_removidos', registros_removidos),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'warning');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'upload_id', p_upload_id,
    'registros_removidos', registros_removidos,
    'motivo', p_motivo,
    'executado_em', now()
  );
  
  RETURN resultado;
END;
$$;