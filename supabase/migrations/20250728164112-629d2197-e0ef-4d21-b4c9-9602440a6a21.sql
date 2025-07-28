-- Análise das tabelas existentes e criação das faltantes para estrutura completa

-- 1. Tabela para Cadastro de Exames (com quebra por categoria)
CREATE TABLE IF NOT EXISTS public.cadastro_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  modalidade_id UUID REFERENCES modalidades(id),
  especialidade_id UUID REFERENCES especialidades(id),
  categoria_id UUID REFERENCES categorias_exame(id),
  prioridade_id UUID REFERENCES prioridades(id),
  modalidade TEXT NOT NULL, -- Para backward compatibility
  especialidade TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  codigo_exame TEXT UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  permite_quebra BOOLEAN NOT NULL DEFAULT false,
  criterio_quebra JSONB, -- Critérios específicos para quebra do exame
  exames_derivados JSONB, -- Array de exames que serão gerados na quebra
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- 2. Tabela para Regras de Exclusão de Faturamento
CREATE TABLE IF NOT EXISTS public.regras_exclusao_faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tipo_regra TEXT NOT NULL CHECK (tipo_regra IN ('cliente', 'modalidade', 'especialidade', 'categoria', 'medico', 'periodo', 'valor')),
  criterios JSONB NOT NULL, -- Condições para aplicar a exclusão
  prioridade INTEGER NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  aplicar_legado BOOLEAN NOT NULL DEFAULT false, -- Se aplica aos dados legado
  aplicar_incremental BOOLEAN NOT NULL DEFAULT true, -- Se aplica aos dados incrementais
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- 3. Expandir tabela de preços de serviços existente para ser mais robusta
ALTER TABLE public.precos_servicos 
ADD COLUMN IF NOT EXISTS codigo_servico TEXT,
ADD COLUMN IF NOT EXISTS tipo_preco TEXT NOT NULL DEFAULT 'padrao' CHECK (tipo_preco IN ('padrao', 'promocional', 'especial')),
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id), -- Preço específico por cliente
ADD COLUMN IF NOT EXISTS aplicar_legado BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS aplicar_incremental BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 4. Tabela para controlar dados legado vs incrementais
CREATE TABLE IF NOT EXISTS public.controle_dados_origem (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_origem TEXT NOT NULL,
  tipo_dados TEXT NOT NULL CHECK (tipo_dados IN ('legado', 'incremental')),
  periodo_referencia TEXT, -- Ex: "2024-01", "2024-Q1", etc
  data_inicio DATE,
  data_fim DATE,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado', 'processando')),
  metadados JSONB,
  total_registros INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- 5. Tabela para histórico de processamento de uploads
CREATE TABLE IF NOT EXISTS public.processamento_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo_nome TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL,
  tipo_dados TEXT NOT NULL CHECK (tipo_dados IN ('legado', 'incremental')),
  periodo_referencia TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  registros_processados INTEGER DEFAULT 0,
  registros_inseridos INTEGER DEFAULT 0,
  registros_atualizados INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  detalhes_erro JSONB,
  tempo_processamento INTERVAL,
  tamanho_arquivo BIGINT,
  hash_arquivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
);

-- Adicionar campo para identificar origem dos dados nas tabelas principais
ALTER TABLE public.volumetria_mobilemed 
ADD COLUMN IF NOT EXISTS tipo_dados TEXT NOT NULL DEFAULT 'incremental' CHECK (tipo_dados IN ('legado', 'incremental')),
ADD COLUMN IF NOT EXISTS periodo_referencia TEXT,
ADD COLUMN IF NOT EXISTS controle_origem_id UUID REFERENCES controle_dados_origem(id);

ALTER TABLE public.faturamento 
ADD COLUMN IF NOT EXISTS tipo_dados TEXT NOT NULL DEFAULT 'incremental' CHECK (tipo_dados IN ('legado', 'incremental')),
ADD COLUMN IF NOT EXISTS periodo_referencia TEXT,
ADD COLUMN IF NOT EXISTS controle_origem_id UUID REFERENCES controle_dados_origem(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cadastro_exames_modalidade ON cadastro_exames(modalidade);
CREATE INDEX IF NOT EXISTS idx_cadastro_exames_especialidade ON cadastro_exames(especialidade);
CREATE INDEX IF NOT EXISTS idx_cadastro_exames_categoria ON cadastro_exames(categoria);
CREATE INDEX IF NOT EXISTS idx_cadastro_exames_ativo ON cadastro_exames(ativo);

CREATE INDEX IF NOT EXISTS idx_regras_exclusao_tipo ON regras_exclusao_faturamento(tipo_regra);
CREATE INDEX IF NOT EXISTS idx_regras_exclusao_ativo ON regras_exclusao_faturamento(ativo);

CREATE INDEX IF NOT EXISTS idx_precos_servicos_cliente ON precos_servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_tipo ON precos_servicos(tipo_preco);

CREATE INDEX IF NOT EXISTS idx_volumetria_tipo_dados ON volumetria_mobilemed(tipo_dados);
CREATE INDEX IF NOT EXISTS idx_volumetria_periodo_ref ON volumetria_mobilemed(periodo_referencia);

CREATE INDEX IF NOT EXISTS idx_faturamento_tipo_dados ON faturamento(tipo_dados);
CREATE INDEX IF NOT EXISTS idx_faturamento_periodo_ref ON faturamento(periodo_referencia);

-- RLS Policies
ALTER TABLE public.cadastro_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_exclusao_faturamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_dados_origem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processamento_uploads ENABLE ROW LEVEL SECURITY;

-- Policies para cadastro_exames
CREATE POLICY "Admins podem gerenciar cadastro exames" 
ON public.cadastro_exames FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver cadastro exames" 
ON public.cadastro_exames FOR SELECT 
USING (is_manager_or_admin());

-- Policies para regras_exclusao_faturamento
CREATE POLICY "Admins podem gerenciar regras exclusão" 
ON public.regras_exclusao_faturamento FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver regras exclusão" 
ON public.regras_exclusao_faturamento FOR SELECT 
USING (is_manager_or_admin());

-- Policies para controle_dados_origem
CREATE POLICY "Admins podem gerenciar controle origem" 
ON public.controle_dados_origem FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver controle origem" 
ON public.controle_dados_origem FOR SELECT 
USING (is_manager_or_admin());

-- Policies para processamento_uploads
CREATE POLICY "Admins podem gerenciar processamento uploads" 
ON public.processamento_uploads FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver processamento uploads" 
ON public.processamento_uploads FOR SELECT 
USING (is_manager_or_admin());

-- Triggers para updated_at
CREATE TRIGGER update_cadastro_exames_updated_at
  BEFORE UPDATE ON public.cadastro_exames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regras_exclusao_updated_at
  BEFORE UPDATE ON public.regras_exclusao_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_controle_origem_updated_at
  BEFORE UPDATE ON public.controle_dados_origem
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();