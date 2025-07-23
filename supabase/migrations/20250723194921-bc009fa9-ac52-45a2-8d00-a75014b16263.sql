-- Criar tabela para gerenciar pendências do sistema
CREATE TABLE IF NOT EXISTS public.pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'resolvida', 'cancelada')),
  modulo TEXT, -- ex: 'volumetria', 'faturamento', etc
  responsavel_id UUID,
  data_limite DATE,
  resolucao TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Habilitar RLS
ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver pendências" ON public.pendencias
  FOR SELECT USING (true);

CREATE POLICY "Admins e managers podem gerenciar pendências" ON public.pendencias
  FOR ALL USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pendencias_updated_at
  BEFORE UPDATE ON public.pendencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir primeira pendência sobre valores zero na volumetria
INSERT INTO public.pendencias (
  titulo,
  descricao,
  categoria,
  prioridade,
  modulo,
  metadata,
  created_by
) VALUES (
  'Arquivo 1: Volumetria Padrão - Registros com valor zero',
  'Identificados 2 registros no upload do Arquivo 1 (Volumetria Padrão) que possuem valor zero no campo VALORES. É necessário configurar tratamento específico para estes casos ou definir regra de apropriação.',
  'dados',
  'media',
  'volumetria',
  '{"arquivo_tipo": "volumetria_padrao", "registros_rejeitados": 2, "total_arquivo": 34436, "inseridos": 34434}',
  (SELECT id FROM auth.users LIMIT 1)
);