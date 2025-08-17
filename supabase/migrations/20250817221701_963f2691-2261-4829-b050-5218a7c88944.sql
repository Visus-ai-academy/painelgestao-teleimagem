-- Criar tabela para controlar período de referência ativo do sistema
CREATE TABLE public.periodo_referencia_ativo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_referencia TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Garantir que apenas um período seja ativo por vez
CREATE UNIQUE INDEX idx_periodo_ativo_unico ON public.periodo_referencia_ativo (ativo) WHERE ativo = true;

-- RLS policies
ALTER TABLE public.periodo_referencia_ativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar período ativo"
ON public.periodo_referencia_ativo
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
  )
);

CREATE POLICY "Todos podem ver período ativo"
ON public.periodo_referencia_ativo
FOR SELECT
TO authenticated
USING (ativo = true);

-- Inserir período padrão (jun/25)
INSERT INTO public.periodo_referencia_ativo (
  periodo_referencia,
  data_inicio,
  data_fim,
  ativo,
  descricao
) VALUES (
  'jun/25',
  '2025-05-08',
  '2025-06-07', 
  true,
  'Período de referência padrão - Junho 2025'
);

-- Comentários para documentação
COMMENT ON TABLE public.periodo_referencia_ativo IS 'Tabela para controlar qual período de referência está ativo no sistema para análises, dashboard e comparativo';
COMMENT ON COLUMN public.periodo_referencia_ativo.periodo_referencia IS 'Período no formato mon/YY (ex: jun/25)';
COMMENT ON COLUMN public.periodo_referencia_ativo.ativo IS 'Apenas um período pode estar ativo por vez';