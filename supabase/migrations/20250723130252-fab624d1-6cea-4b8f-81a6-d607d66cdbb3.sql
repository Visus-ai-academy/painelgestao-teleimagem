-- Criar tabela de preços de serviços prestados
CREATE TABLE public.precos_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modalidade_id UUID REFERENCES modalidades(id),
  especialidade_id UUID REFERENCES especialidades(id),
  categoria_exame_id UUID REFERENCES categorias_exame(id),
  prioridade_id UUID REFERENCES prioridades(id),
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  valor_base NUMERIC NOT NULL DEFAULT 0,
  valor_urgencia NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar índices para performance
CREATE INDEX idx_precos_servicos_modalidade ON public.precos_servicos(modalidade);
CREATE INDEX idx_precos_servicos_especialidade ON public.precos_servicos(especialidade);
CREATE INDEX idx_precos_servicos_categoria ON public.precos_servicos(categoria);
CREATE INDEX idx_precos_servicos_prioridade ON public.precos_servicos(prioridade);
CREATE INDEX idx_precos_servicos_vigencia ON public.precos_servicos(data_inicio_vigencia, data_fim_vigencia);

-- Enable RLS
ALTER TABLE public.precos_servicos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins podem gerenciar preços serviços" 
ON public.precos_servicos 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver preços serviços" 
ON public.precos_servicos 
FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para updated_at
CREATE TRIGGER update_precos_servicos_updated_at
BEFORE UPDATE ON public.precos_servicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de contratos de clientes (caso não exista)
CREATE TABLE IF NOT EXISTS public.contratos_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) NOT NULL,
  numero_contrato TEXT NOT NULL UNIQUE,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  valor_mensal NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  modalidades TEXT[] DEFAULT '{}',
  especialidades TEXT[] DEFAULT '{}',
  desconto_percentual NUMERIC DEFAULT 0,
  acrescimo_percentual NUMERIC DEFAULT 0,
  forma_pagamento TEXT DEFAULT 'mensal',
  dia_vencimento INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar índices para contratos
CREATE INDEX IF NOT EXISTS idx_contratos_clientes_cliente ON public.contratos_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_clientes_status ON public.contratos_clientes(status);
CREATE INDEX IF NOT EXISTS idx_contratos_clientes_vigencia ON public.contratos_clientes(data_inicio, data_fim);

-- Enable RLS para contratos
ALTER TABLE public.contratos_clientes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies para contratos
CREATE POLICY "Admins podem gerenciar contratos clientes" 
ON public.contratos_clientes 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver contratos clientes" 
ON public.contratos_clientes 
FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para contratos
CREATE TRIGGER update_contratos_clientes_updated_at
BEFORE UPDATE ON public.contratos_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de regras de contrato (para vincular preços específicos por cliente)
CREATE TABLE public.regras_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID REFERENCES contratos_clientes(id) ON DELETE CASCADE NOT NULL,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  valor_personalizado NUMERIC,
  desconto_percentual NUMERIC DEFAULT 0,
  acrescimo_percentual NUMERIC DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(contrato_id, modalidade, especialidade, categoria, prioridade, data_inicio_vigencia)
);

-- Criar índices para regras de contrato
CREATE INDEX idx_regras_contrato_contrato ON public.regras_contrato(contrato_id);
CREATE INDEX idx_regras_contrato_modalidade ON public.regras_contrato(modalidade);
CREATE INDEX idx_regras_contrato_vigencia ON public.regras_contrato(data_inicio_vigencia, data_fim_vigencia);

-- Enable RLS para regras
ALTER TABLE public.regras_contrato ENABLE ROW LEVEL SECURITY;

-- Create RLS policies para regras
CREATE POLICY "Admins podem gerenciar regras contrato" 
ON public.regras_contrato 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver regras contrato" 
ON public.regras_contrato 
FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para regras
CREATE TRIGGER update_regras_contrato_updated_at
BEFORE UPDATE ON public.regras_contrato
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar função para calcular período de faturamento
CREATE OR REPLACE FUNCTION public.get_periodo_faturamento(data_referencia DATE)
RETURNS TABLE(
  inicio_periodo DATE,
  fim_periodo DATE,
  mes_referencia TEXT,
  ano_referencia INTEGER
) AS $$
DECLARE
  inicio_periodo_var DATE;
  fim_periodo_var DATE;
  mes_ref INTEGER;
  ano_ref INTEGER;
BEGIN
  -- Se a data for antes do dia 8, o período é do mês anterior
  IF EXTRACT(DAY FROM data_referencia) < 8 THEN
    -- Período: dia 8 do mês anterior ao anterior até dia 7 do mês anterior
    inicio_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '2 months')::DATE + INTERVAL '7 days';
    fim_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '1 month')::DATE + INTERVAL '6 days';
    mes_ref := EXTRACT(MONTH FROM data_referencia - INTERVAL '2 months');
    ano_ref := EXTRACT(YEAR FROM data_referencia - INTERVAL '2 months');
  ELSE
    -- Período: dia 8 do mês anterior até dia 7 do mês atual
    inicio_periodo_var := DATE_TRUNC('month', data_referencia - INTERVAL '1 month')::DATE + INTERVAL '7 days';
    fim_periodo_var := DATE_TRUNC('month', data_referencia)::DATE + INTERVAL '6 days';
    mes_ref := EXTRACT(MONTH FROM data_referencia - INTERVAL '1 month');
    ano_ref := EXTRACT(YEAR FROM data_referencia - INTERVAL '1 month');
  END IF;
  
  RETURN QUERY SELECT 
    inicio_periodo_var,
    fim_periodo_var,
    CASE mes_ref
      WHEN 1 THEN 'Janeiro'
      WHEN 2 THEN 'Fevereiro'
      WHEN 3 THEN 'Março'
      WHEN 4 THEN 'Abril'
      WHEN 5 THEN 'Maio'
      WHEN 6 THEN 'Junho'
      WHEN 7 THEN 'Julho'
      WHEN 8 THEN 'Agosto'
      WHEN 9 THEN 'Setembro'
      WHEN 10 THEN 'Outubro'
      WHEN 11 THEN 'Novembro'
      WHEN 12 THEN 'Dezembro'
    END || '/' || SUBSTRING(ano_ref::TEXT FROM 3),
    ano_ref;
END;
$$ LANGUAGE plpgsql;