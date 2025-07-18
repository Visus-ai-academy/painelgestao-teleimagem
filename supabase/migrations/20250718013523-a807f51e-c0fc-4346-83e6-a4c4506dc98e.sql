-- Função para verificar se dados podem ser editados baseado nas regras de proteção
CREATE OR REPLACE FUNCTION public.can_edit_data(data_referencia DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- Dados futuros não podem ser inseridos/editados
  IF data_referencia > CURRENT_DATE THEN
    RETURN FALSE;
  END IF;
  
  -- Dados históricos (meses anteriores) são imutáveis
  IF DATE_TRUNC('month', data_referencia) < DATE_TRUNC('month', CURRENT_DATE) THEN
    RETURN FALSE;
  END IF;
  
  -- Dados do mês atual podem ser editados até o dia 5 do mês posterior
  IF DATE_TRUNC('month', data_referencia) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
     AND EXTRACT(DAY FROM CURRENT_DATE) > 5 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para verificar se dados podem ser visualizados (sempre true para dashboards)
CREATE OR REPLACE FUNCTION public.can_view_data(data_referencia DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- Dados futuros não podem ser visualizados
  IF data_referencia > CURRENT_DATE THEN
    RETURN FALSE;
  END IF;
  
  -- Todos os outros dados podem ser visualizados
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para verificar se dados podem ser inseridos
CREATE OR REPLACE FUNCTION public.can_insert_data(data_referencia DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- Não permite upload de dados futuros
  IF data_referencia > CURRENT_DATE THEN
    RETURN FALSE;
  END IF;
  
  -- Só permite inserir dados do mês atual
  IF DATE_TRUNC('month', data_referencia) != DATE_TRUNC('month', CURRENT_DATE) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Aplicar políticas de proteção na tabela escalas_medicas
DROP POLICY IF EXISTS "Proteção temporal - SELECT escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - SELECT escalas" 
ON public.escalas_medicas 
FOR SELECT 
USING (
  can_view_data(data) AND 
  (is_manager_or_admin() OR (has_role(auth.uid(), 'medico'::app_role) AND medico_id IN (
    SELECT id FROM medicos WHERE user_id = auth.uid()
  )))
);

DROP POLICY IF EXISTS "Proteção temporal - UPDATE escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - UPDATE escalas" 
ON public.escalas_medicas 
FOR UPDATE 
USING (
  can_edit_data(data) AND 
  (is_manager_or_admin() OR (has_role(auth.uid(), 'medico'::app_role) AND medico_id IN (
    SELECT id FROM medicos WHERE user_id = auth.uid()
  )))
)
WITH CHECK (
  can_edit_data(data) AND 
  (is_manager_or_admin() OR (has_role(auth.uid(), 'medico'::app_role) AND medico_id IN (
    SELECT id FROM medicos WHERE user_id = auth.uid()
  )))
);

DROP POLICY IF EXISTS "Proteção temporal - INSERT escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - INSERT escalas" 
ON public.escalas_medicas 
FOR INSERT 
WITH CHECK (
  can_insert_data(data) AND 
  (is_manager_or_admin() OR (has_role(auth.uid(), 'medico'::app_role) AND medico_id IN (
    SELECT id FROM medicos WHERE user_id = auth.uid()
  )))
);

DROP POLICY IF EXISTS "Proteção temporal - DELETE escalas" ON public.escalas_medicas;
CREATE POLICY "Proteção temporal - DELETE escalas" 
ON public.escalas_medicas 
FOR DELETE 
USING (
  can_edit_data(data) AND is_manager_or_admin()
);

-- Aplicar políticas de proteção na tabela faturamento
DROP POLICY IF EXISTS "Proteção temporal - SELECT faturamento" ON public.faturamento;
CREATE POLICY "Proteção temporal - SELECT faturamento" 
ON public.faturamento 
FOR SELECT 
USING (
  can_view_data(data_emissao) AND is_manager_or_admin()
);

DROP POLICY IF EXISTS "Proteção temporal - UPDATE faturamento" ON public.faturamento;
CREATE POLICY "Proteção temporal - UPDATE faturamento" 
ON public.faturamento 
FOR UPDATE 
USING (
  can_edit_data(data_emissao) AND is_admin()
)
WITH CHECK (
  can_edit_data(data_emissao) AND is_admin()
);

DROP POLICY IF EXISTS "Proteção temporal - INSERT faturamento" ON public.faturamento;
CREATE POLICY "Proteção temporal - INSERT faturamento" 
ON public.faturamento 
FOR INSERT 
WITH CHECK (
  can_insert_data(data_emissao) AND is_admin()
);

DROP POLICY IF EXISTS "Proteção temporal - DELETE faturamento" ON public.faturamento;
CREATE POLICY "Proteção temporal - DELETE faturamento" 
ON public.faturamento 
FOR DELETE 
USING (
  can_edit_data(data_emissao) AND is_admin()
);

-- Criar tabela de configuração para regras de proteção (opcional - para flexibilidade futura)
CREATE TABLE IF NOT EXISTS public.configuracao_protecao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dias_edicao_mes_anterior INTEGER NOT NULL DEFAULT 5,
  permite_dados_futuros BOOLEAN NOT NULL DEFAULT FALSE,
  permite_edicao_historico BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Inserir configuração padrão
INSERT INTO public.configuracao_protecao (dias_edicao_mes_anterior, permite_dados_futuros, permite_edicao_historico)
VALUES (5, FALSE, FALSE)
ON CONFLICT DO NOTHING;

-- RLS para tabela de configuração
ALTER TABLE public.configuracao_protecao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar configuração proteção"
ON public.configuracao_protecao
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracao_protecao_updated_at
  BEFORE UPDATE ON public.configuracao_protecao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();