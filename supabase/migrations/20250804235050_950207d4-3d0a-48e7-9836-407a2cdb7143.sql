-- Verificar se a tabela precos_servicos existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'precos_servicos'
);

-- Criar tabela precos_servicos se não existir
CREATE TABLE IF NOT EXISTS public.precos_servicos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  modalidade text NOT NULL,
  especialidade text NOT NULL,
  categoria text NOT NULL DEFAULT 'Normal',
  prioridade text NOT NULL DEFAULT 'Rotina',
  valor numeric NOT NULL DEFAULT 0,
  desconto_percentual numeric DEFAULT 0,
  acrescimo_percentual numeric DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  observacoes text,
  UNIQUE(cliente_id, modalidade, especialidade, categoria, prioridade)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_precos_servicos_cliente_id ON public.precos_servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_modalidade ON public.precos_servicos(modalidade);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_especialidade ON public.precos_servicos(especialidade);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_ativo ON public.precos_servicos(ativo);

-- Habilitar RLS
ALTER TABLE public.precos_servicos ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Admins podem gerenciar preços" ON public.precos_servicos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver preços" ON public.precos_servicos
  FOR SELECT USING (is_manager_or_admin());

-- Criar trigger para updated_at
CREATE TRIGGER update_precos_servicos_updated_at
  BEFORE UPDATE ON public.precos_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();