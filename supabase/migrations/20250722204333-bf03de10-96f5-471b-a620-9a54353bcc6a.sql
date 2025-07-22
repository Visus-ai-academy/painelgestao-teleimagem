-- Criar nova tabela volumetria_mobilemed com nomes exatos das colunas dos arquivos
DROP TABLE IF EXISTS public.volumetria_mobilemed;

CREATE TABLE public.volumetria_mobilemed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo_fonte TEXT NOT NULL CHECK (arquivo_fonte IN ('data_laudo', 'data_exame')),
  data_upload TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Campos exatos dos arquivos CSV/Excel
  "EMPRESA" TEXT NOT NULL,
  "NOME_PACIENTE" TEXT NOT NULL,
  "CODIGO_PACIENTE" TEXT,
  "ESTUDO_DESCRICAO" TEXT,
  "ACCESSION_NUMBER" TEXT,
  "MODALIDADE" TEXT,
  "PRIORIDADE" TEXT,
  "VALORES" INTEGER,
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
  "IMAGENS_CHAVES" INTEGER,
  "IMAGENS_CAPTURADAS" INTEGER,
  "CODIGO_INTERNO" INTEGER,
  "DIGITADOR" TEXT,
  "COMPLEMENTAR" TEXT,
  
  -- Campo calculado automaticamente
  data_referencia DATE,
  
  -- Campos de auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_volumetria_mobilemed_empresa ON public.volumetria_mobilemed("EMPRESA");
CREATE INDEX idx_volumetria_mobilemed_data_referencia ON public.volumetria_mobilemed(data_referencia);
CREATE INDEX idx_volumetria_mobilemed_arquivo_fonte ON public.volumetria_mobilemed(arquivo_fonte);
CREATE INDEX idx_volumetria_mobilemed_accession ON public.volumetria_mobilemed("ACCESSION_NUMBER");
CREATE INDEX idx_volumetria_mobilemed_especialidade ON public.volumetria_mobilemed("ESPECIALIDADE");
CREATE INDEX idx_volumetria_mobilemed_modalidade ON public.volumetria_mobilemed("MODALIDADE");

-- Enable Row Level Security
ALTER TABLE public.volumetria_mobilemed ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins podem gerenciar volumetria" 
ON public.volumetria_mobilemed 
FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver volumetria" 
ON public.volumetria_mobilemed 
FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para updated_at
CREATE TRIGGER update_volumetria_mobilemed_updated_at
BEFORE UPDATE ON public.volumetria_mobilemed
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para definir data_referencia automaticamente
CREATE OR REPLACE FUNCTION public.set_data_referencia_volumetria()
RETURNS TRIGGER AS $$
BEGIN
  -- Define data_referencia baseado no tipo de arquivo
  IF NEW.arquivo_fonte = 'data_laudo' THEN
    NEW.data_referencia = NEW."DATA_LAUDO";
  ELSIF NEW.arquivo_fonte = 'data_exame' THEN
    NEW.data_referencia = NEW."DATA_REALIZACAO";
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para data_referencia
CREATE TRIGGER set_data_referencia_trigger
BEFORE INSERT OR UPDATE ON public.volumetria_mobilemed
FOR EACH ROW
EXECUTE FUNCTION public.set_data_referencia_volumetria();