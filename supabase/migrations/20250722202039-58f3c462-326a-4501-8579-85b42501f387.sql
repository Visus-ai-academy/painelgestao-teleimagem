-- Criar nova tabela para volumetria do MobileMed
-- Suporta ambos os arquivos: Data_Laudo e Data_Exame
CREATE TABLE public.volumetria_mobilemed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Metadados do arquivo
  arquivo_fonte TEXT NOT NULL CHECK (arquivo_fonte IN ('data_laudo', 'data_exame')),
  data_upload TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Campos originais do MobileMed (30 colunas)
  empresa TEXT NOT NULL,
  nome_paciente TEXT NOT NULL,
  codigo_paciente TEXT,
  estudo_descricao TEXT,
  accession_number TEXT,
  modalidade TEXT,
  prioridade TEXT,
  valores INTEGER, -- Convertido de decimal para inteiro (parte inteira apenas)
  especialidade TEXT,
  medico TEXT,
  duplicado TEXT,
  
  -- Campos de data convertidos (TEXT → DATE)
  data_realizacao DATE,
  data_transferencia DATE,
  data_laudo DATE,
  data_prazo DATE,
  data_reassinatura DATE,
  
  -- Campos de hora convertidos (TEXT → TIME)
  hora_realizacao TIME,
  hora_transferencia TIME,
  hora_laudo TIME,
  hora_prazo TIME,
  hora_reassinatura TIME,
  
  -- Campos restantes como texto
  status TEXT,
  medico_reassinatura TEXT,
  segunda_assinatura TEXT,
  possui_imagens_chave TEXT,
  imagens_chaves INTEGER,
  imagens_capturadas INTEGER,
  codigo_interno INTEGER,
  digitador TEXT,
  complementar TEXT,
  
  -- Campos para controle e auditoria
  data_referencia DATE, -- Campo calculado baseado no arquivo_fonte
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Índices para performance
  UNIQUE(accession_number, arquivo_fonte) -- Evita duplicatas por arquivo
);

-- Criar índices para consultas frequentes
CREATE INDEX idx_volumetria_empresa ON public.volumetria_mobilemed(empresa);
CREATE INDEX idx_volumetria_data_referencia ON public.volumetria_mobilemed(data_referencia);
CREATE INDEX idx_volumetria_fonte ON public.volumetria_mobilemed(arquivo_fonte);
CREATE INDEX idx_volumetria_accession ON public.volumetria_mobilemed(accession_number);
CREATE INDEX idx_volumetria_especialidade ON public.volumetria_mobilemed(especialidade);
CREATE INDEX idx_volumetria_modalidade ON public.volumetria_mobilemed(modalidade);

-- Habilitar RLS
ALTER TABLE public.volumetria_mobilemed ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar volumetria" 
ON public.volumetria_mobilemed FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver volumetria" 
ON public.volumetria_mobilemed FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para updated_at
CREATE TRIGGER update_volumetria_mobilemed_updated_at
BEFORE UPDATE ON public.volumetria_mobilemed
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular data_referencia baseado no arquivo_fonte
CREATE OR REPLACE FUNCTION public.set_data_referencia_volumetria()
RETURNS TRIGGER AS $$
BEGIN
  -- Define data_referencia baseado no tipo de arquivo
  IF NEW.arquivo_fonte = 'data_laudo' THEN
    NEW.data_referencia = NEW.data_laudo;
  ELSIF NEW.arquivo_fonte = 'data_exame' THEN
    NEW.data_referencia = NEW.data_realizacao;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para definir data_referencia automaticamente
CREATE TRIGGER set_data_referencia_trigger
BEFORE INSERT OR UPDATE ON public.volumetria_mobilemed
FOR EACH ROW
EXECUTE FUNCTION public.set_data_referencia_volumetria();