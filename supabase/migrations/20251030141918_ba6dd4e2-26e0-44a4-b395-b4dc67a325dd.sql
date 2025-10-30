-- Criar tabela de mapeamento de nomes de médicos
CREATE TABLE IF NOT EXISTS public.mapeamento_nomes_medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_origem TEXT NOT NULL,
  nome_origem_normalizado TEXT NOT NULL,
  medico_id UUID REFERENCES public.medicos(id) ON DELETE CASCADE,
  medico_nome TEXT NOT NULL,
  tipo_origem TEXT NOT NULL, -- 'repasse', 'volumetria', 'manual'
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_automaticamente BOOLEAN NOT NULL DEFAULT false,
  verificado_manualmente BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(nome_origem_normalizado, medico_id)
);

-- Criar índices para performance
CREATE INDEX idx_mapeamento_nomes_origem_normalizado ON public.mapeamento_nomes_medicos(nome_origem_normalizado);
CREATE INDEX idx_mapeamento_nomes_medico_id ON public.mapeamento_nomes_medicos(medico_id);
CREATE INDEX idx_mapeamento_nomes_ativo ON public.mapeamento_nomes_medicos(ativo);

-- Adicionar coluna para guardar nome original do médico na tabela de repasse
ALTER TABLE public.medicos_valores_repasse 
ADD COLUMN IF NOT EXISTS medico_nome_original TEXT;

-- Criar índice para o nome original
CREATE INDEX IF NOT EXISTS idx_repasse_medico_nome_original 
ON public.medicos_valores_repasse(medico_nome_original);

-- RLS Policies
ALTER TABLE public.mapeamento_nomes_medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar mapeamentos"
ON public.mapeamento_nomes_medicos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Managers podem ver mapeamentos"
ON public.mapeamento_nomes_medicos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Função para normalizar nomes (remover acentos, dr/dra, espaços extras)
CREATE OR REPLACE FUNCTION normalizar_nome_medico(nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          UNACCENT(nome),
          '\s+', ' ', 'g'
        ),
        '(^|\s)(dr\.?|dra\.?)\s*', '', 'gi'
      )
    )
  );
END;
$$;

COMMENT ON TABLE public.mapeamento_nomes_medicos IS 'Tabela para mapear variações de nomes de médicos para o cadastro correto';
COMMENT ON COLUMN public.mapeamento_nomes_medicos.nome_origem IS 'Nome como aparece no arquivo de origem';
COMMENT ON COLUMN public.mapeamento_nomes_medicos.nome_origem_normalizado IS 'Nome normalizado para busca (sem acentos, dr/dra, etc)';
COMMENT ON COLUMN public.mapeamento_nomes_medicos.tipo_origem IS 'Origem do mapeamento: repasse, volumetria ou manual';
COMMENT ON COLUMN public.mapeamento_nomes_medicos.criado_automaticamente IS 'Se foi criado por sugestão automática';
COMMENT ON COLUMN public.mapeamento_nomes_medicos.verificado_manualmente IS 'Se foi verificado e aprovado manualmente por um gestor';