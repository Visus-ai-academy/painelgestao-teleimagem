-- Criar tabela de staging para upload rápido
CREATE TABLE public.volumetria_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "EMPRESA" TEXT,
  "NOME_PACIENTE" TEXT,
  "CODIGO_PACIENTE" TEXT,
  "ESTUDO_DESCRICAO" TEXT,
  "ACCESSION_NUMBER" TEXT,
  "MODALIDADE" TEXT,
  "PRIORIDADE" TEXT,
  "VALORES" NUMERIC,
  "ESPECIALIDADE" TEXT,
  "MEDICO" TEXT,
  "DUPLICADO" TEXT,
  "DATA_REALIZACAO" DATE,
  "HORA_REALIZACAO" TIME,
  "DATA_TRANSFERENCIA" DATE,
  "HORA_TRANSFERENCIA" TIME,
  "DATA_LAUDO" DATE,
  "HORA_LAUDO" TIME,
  "DATA_PRAZO" DATE,
  "HORA_PRAZO" TIME,
  "STATUS" TEXT,
  "DATA_REASSINATURA" DATE,
  "HORA_REASSINATURA" TIME,
  "MEDICO_REASSINATURA" TEXT,
  "SEGUNDA_ASSINATURA" TEXT,
  "POSSUI_IMAGENS_CHAVE" TEXT,
  "IMAGENS_CHAVES" TEXT,
  "IMAGENS_CAPTURADAS" TEXT,
  "CODIGO_INTERNO" TEXT,
  "DIGITADOR" TEXT,
  "COMPLEMENTAR" TEXT,
  data_referencia DATE,
  arquivo_fonte TEXT,
  lote_upload TEXT,
  periodo_referencia TEXT,
  "CATEGORIA" TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tipo_faturamento TEXT,
  processamento_pendente BOOLEAN DEFAULT true,
  -- Campos de controle de staging
  status_processamento TEXT DEFAULT 'pendente' CHECK (status_processamento IN ('pendente', 'processando', 'concluido', 'erro')),
  erro_processamento TEXT,
  tentativas_processamento INTEGER DEFAULT 0,
  processado_em TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_volumetria_staging_lote_upload ON public.volumetria_staging(lote_upload);
CREATE INDEX idx_volumetria_staging_status ON public.volumetria_staging(status_processamento);
CREATE INDEX idx_volumetria_staging_arquivo_fonte ON public.volumetria_staging(arquivo_fonte);
CREATE INDEX idx_volumetria_staging_created_at ON public.volumetria_staging(created_at);

-- RLS policies para staging
ALTER TABLE public.volumetria_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar staging"
ON public.volumetria_staging
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Sistema pode inserir staging"
ON public.volumetria_staging
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Função para limpeza automática de staging
CREATE OR REPLACE FUNCTION public.limpar_staging_processado()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  registros_removidos INTEGER;
BEGIN
  -- Remove registros processados há mais de 1 hora
  DELETE FROM volumetria_staging 
  WHERE status_processamento = 'concluido' 
    AND processado_em < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS registros_removidos = ROW_COUNT;
  
  -- Remove registros com erro há mais de 24 horas
  DELETE FROM volumetria_staging 
  WHERE status_processamento = 'erro' 
    AND updated_at < NOW() - INTERVAL '24 hours';
  
  RETURN registros_removidos;
END;
$$;