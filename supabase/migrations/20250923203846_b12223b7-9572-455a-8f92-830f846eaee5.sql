-- Criar tabela para demonstrativos pré-calculados
CREATE TABLE public.demonstrativos_faturamento_calculados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_referencia TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  cliente_nome TEXT NOT NULL,
  
  -- Dados do cliente
  total_exames INTEGER DEFAULT 0,
  total_registros INTEGER DEFAULT 0,
  volume_referencia INTEGER DEFAULT 0,
  condicao_volume TEXT,
  
  -- Valores calculados
  valor_exames NUMERIC DEFAULT 0,
  valor_franquia NUMERIC DEFAULT 0,
  valor_portal_laudos NUMERIC DEFAULT 0,
  valor_integracao NUMERIC DEFAULT 0,
  valor_bruto_total NUMERIC DEFAULT 0,
  
  -- Impostos
  percentual_iss NUMERIC DEFAULT 0,
  valor_iss NUMERIC DEFAULT 0,
  impostos_ab_min NUMERIC DEFAULT 0,
  valor_impostos_federais NUMERIC DEFAULT 0,
  valor_total_impostos NUMERIC DEFAULT 0,
  
  -- Totais finais
  valor_liquido NUMERIC DEFAULT 0,
  valor_total_faturamento NUMERIC DEFAULT 0,
  
  -- Detalhes dos cálculos
  detalhes_franquia JSONB DEFAULT '{}',
  detalhes_exames JSONB DEFAULT '[]',
  parametros_utilizados JSONB DEFAULT '{}',
  
  -- Status e controle
  status TEXT DEFAULT 'calculado' CHECK (status IN ('calculado', 'processando', 'erro')),
  erro_detalhes TEXT,
  
  -- Auditoria
  calculado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  calculado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_demonstrativos_periodo_cliente ON public.demonstrativos_faturamento_calculados(periodo_referencia, cliente_nome);
CREATE INDEX idx_demonstrativos_periodo ON public.demonstrativos_faturamento_calculados(periodo_referencia);
CREATE INDEX idx_demonstrativos_calculado_em ON public.demonstrativos_faturamento_calculados(calculado_em);

-- RLS policies
ALTER TABLE public.demonstrativos_faturamento_calculados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar demonstrativos calculados"
ON public.demonstrativos_faturamento_calculados
FOR ALL USING (
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

CREATE POLICY "Managers podem ver demonstrativos calculados"
ON public.demonstrativos_faturamento_calculados
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- Função para trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_demonstrativos_calculados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_demonstrativos_calculados_updated_at
  BEFORE UPDATE ON public.demonstrativos_faturamento_calculados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_demonstrativos_calculados_updated_at();

-- Função para limpar demonstrativos antigos (opcional)
CREATE OR REPLACE FUNCTION public.limpar_demonstrativos_periodo(p_periodo_referencia TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  registros_removidos INTEGER;
BEGIN
  DELETE FROM demonstrativos_faturamento_calculados 
  WHERE periodo_referencia = p_periodo_referencia;
  
  GET DIAGNOSTICS registros_removidos = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('demonstrativos_faturamento_calculados', 'LIMPAR_PERIODO', p_periodo_referencia, 
          jsonb_build_object('registros_removidos', registros_removidos, 'periodo', p_periodo_referencia),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  RETURN registros_removidos;
END;
$$;