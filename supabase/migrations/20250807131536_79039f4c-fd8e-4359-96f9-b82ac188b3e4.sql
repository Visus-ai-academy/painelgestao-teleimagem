-- Tabela para controlar o fechamento de faturamento por período
CREATE TABLE public.fechamento_faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_referencia TEXT NOT NULL, -- formato: "jan/25", "fev/25", etc.
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto', -- 'aberto', 'fechado'
  data_fechamento TIMESTAMP WITH TIME ZONE,
  fechado_por UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_periodo_referencia UNIQUE (periodo_referencia)
);

-- RLS para fechamento_faturamento
ALTER TABLE public.fechamento_faturamento ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar fechamentos
CREATE POLICY "Admins podem gerenciar fechamentos" 
ON public.fechamento_faturamento 
FOR ALL
USING (public.is_admin(auth.uid()));

-- Managers podem ver fechamentos
CREATE POLICY "Managers podem ver fechamentos" 
ON public.fechamento_faturamento 
FOR SELECT
USING (public.is_manager_or_admin(auth.uid()));

-- Função para verificar se período está fechado
CREATE OR REPLACE FUNCTION public.periodo_esta_fechado(p_periodo_referencia TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM fechamento_faturamento 
    WHERE periodo_referencia = p_periodo_referencia 
    AND status = 'fechado'
  );
END;
$function$;

-- Função para fechar período de faturamento
CREATE OR REPLACE FUNCTION public.fechar_periodo_faturamento(
  p_periodo_referencia TEXT,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resultado jsonb;
  data_inicio_calc DATE;
  data_fim_calc DATE;
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Apenas administradores podem fechar períodos de faturamento'
    );
  END IF;

  -- Calcular datas do período baseado na referência
  -- Exemplo: "jan/25" -> 08/12/2024 até 07/01/2025
  WITH periodo_calc AS (
    SELECT 
      DATE_TRUNC('month', 
        CASE 
          WHEN SUBSTRING(p_periodo_referencia FROM '\d{2}$') = '25' THEN
            DATE_TRUNC('month', DATE '2024-12-01' + 
              (CASE SUBSTRING(p_periodo_referencia FROM '^[^/]+')
                WHEN 'jan' THEN 1
                WHEN 'fev' THEN 2
                WHEN 'mar' THEN 3
                WHEN 'abr' THEN 4
                WHEN 'mai' THEN 5
                WHEN 'jun' THEN 6
                WHEN 'jul' THEN 7
                WHEN 'ago' THEN 8
                WHEN 'set' THEN 9
                WHEN 'out' THEN 10
                WHEN 'nov' THEN 11
                WHEN 'dez' THEN 12
                ELSE 1
              END - 1) * INTERVAL '1 month'
            )
          ELSE DATE '2025-01-01' -- fallback
        END
      ) AS base_date
  )
  SELECT 
    (base_date - INTERVAL '1 month')::DATE + 7 AS inicio_periodo,
    base_date::DATE + 6 AS fim_periodo
  INTO data_inicio_calc, data_fim_calc
  FROM periodo_calc;

  -- Verificar se período já está fechado
  IF periodo_esta_fechado(p_periodo_referencia) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Período já está fechado'
    );
  END IF;

  -- Inserir ou atualizar fechamento
  INSERT INTO fechamento_faturamento (
    periodo_referencia, 
    data_inicio, 
    data_fim, 
    status, 
    data_fechamento, 
    fechado_por, 
    observacoes
  )
  VALUES (
    p_periodo_referencia,
    data_inicio_calc,
    data_fim_calc,
    'fechado',
    now(),
    auth.uid(),
    p_observacoes
  )
  ON CONFLICT (periodo_referencia) 
  DO UPDATE SET
    status = 'fechado',
    data_fechamento = now(),
    fechado_por = auth.uid(),
    observacoes = p_observacoes,
    updated_at = now();

  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('fechamento_faturamento', 'FECHAR_PERIODO', p_periodo_referencia, 
          jsonb_build_object('periodo', p_periodo_referencia, 'observacoes', p_observacoes),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  resultado := jsonb_build_object(
    'sucesso', true,
    'periodo_referencia', p_periodo_referencia,
    'data_fechamento', now(),
    'mensagem', 'Período fechado com sucesso'
  );

  RETURN resultado;
END;
$function$;

-- Função para reabrir período (apenas admins)
CREATE OR REPLACE FUNCTION public.reabrir_periodo_faturamento(p_periodo_referencia TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se usuário é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Apenas administradores podem reabrir períodos'
    );
  END IF;

  -- Atualizar status para aberto
  UPDATE fechamento_faturamento 
  SET status = 'aberto',
      data_fechamento = NULL,
      updated_at = now()
  WHERE periodo_referencia = p_periodo_referencia;

  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('fechamento_faturamento', 'REABRIR_PERIODO', p_periodo_referencia, 
          jsonb_build_object('periodo', p_periodo_referencia),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'warning');

  RETURN jsonb_build_object(
    'sucesso', true,
    'periodo_referencia', p_periodo_referencia,
    'mensagem', 'Período reaberto com sucesso'
  );
END;
$function$;

-- Atualizar RLS policies para considerar fechamento de período
-- Função melhorada para verificar se pode inserir dados
CREATE OR REPLACE FUNCTION public.can_insert_data(data_referencia date)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  periodo_ref TEXT;
BEGIN
  -- Não permite upload de dados futuros
  IF data_referencia > CURRENT_DATE THEN
    RETURN FALSE;
  END IF;
  
  -- Só permite inserir dados do mês atual
  IF DATE_TRUNC('month', data_referencia) != DATE_TRUNC('month', CURRENT_DATE) THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se período está fechado
  periodo_ref := TO_CHAR(data_referencia, 'mon/YY');
  IF periodo_esta_fechado(periodo_ref) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;

-- Função melhorada para verificar se pode editar dados
CREATE OR REPLACE FUNCTION public.can_edit_data(data_referencia date)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  periodo_ref TEXT;
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
  
  -- Verificar se período está fechado
  periodo_ref := TO_CHAR(data_referencia, 'mon/YY');
  IF periodo_esta_fechado(periodo_ref) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fechamento_faturamento_updated_at
  BEFORE UPDATE ON public.fechamento_faturamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();