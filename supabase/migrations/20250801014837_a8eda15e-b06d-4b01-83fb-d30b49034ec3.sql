-- Verificar se a tabela logs_presenca já existe, se não, criar
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logs_presenca') THEN
    -- Tabela para logs de presença (auditoria)
    CREATE TABLE public.logs_presenca (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      presenca_id UUID NOT NULL,
      medico_id UUID NOT NULL,
      acao TEXT NOT NULL, -- 'checkin', 'checkout_manual', 'checkout_automatico', 'alerta_deslogou'
      timestamp_acao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      ip_address INET,
      user_agent TEXT,
      observacoes TEXT,
      FOREIGN KEY (presenca_id) REFERENCES presenca_medico(id) ON DELETE CASCADE
    );

    -- Enable RLS para logs
    ALTER TABLE public.logs_presenca ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Médicos podem ver seus próprios logs" 
    ON public.logs_presenca 
    FOR SELECT 
    USING (medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) OR is_manager_or_admin());
  END IF;
END $$;

-- Função para fazer check-in
CREATE OR REPLACE FUNCTION public.fazer_checkin_presenca(
  p_escala_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_dispositivo_info JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_medico_id UUID;
  v_data_escala DATE;
  v_horario_inicio TIME;
  v_horario_fim TIME;
  v_presenca_id UUID;
  resultado JSONB;
BEGIN
  -- Buscar dados da escala
  SELECT medico_id, data, horario_inicio, horario_fim 
  INTO v_medico_id, v_data_escala, v_horario_inicio, v_horario_fim
  FROM escalas_medicas 
  WHERE id = p_escala_id 
    AND medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Escala não encontrada ou você não tem permissão'
    );
  END IF;
  
  -- Verificar se é o dia da escala
  IF v_data_escala != CURRENT_DATE THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Check-in só pode ser feito no dia da escala'
    );
  END IF;
  
  -- Verificar se já existe presença para hoje
  SELECT id INTO v_presenca_id
  FROM presenca_medico
  WHERE medico_id = v_medico_id 
    AND escala_id = p_escala_id
    AND data_presenca = CURRENT_DATE;
  
  -- Se já existe, fazer update
  IF v_presenca_id IS NOT NULL THEN
    UPDATE presenca_medico 
    SET horario_checkin = now(),
        status_presenca = 'presente',
        alerta_ativo = false,
        ip_address = p_ip_address,
        dispositivo_info = p_dispositivo_info,
        updated_at = now()
    WHERE id = v_presenca_id;
  ELSE
    -- Criar nova presença
    INSERT INTO presenca_medico (
      medico_id, escala_id, data_presenca, horario_checkin, 
      status_presenca, ip_address, dispositivo_info
    ) VALUES (
      v_medico_id, p_escala_id, CURRENT_DATE, now(),
      'presente', p_ip_address, p_dispositivo_info
    ) RETURNING id INTO v_presenca_id;
  END IF;
  
  -- Log da ação
  INSERT INTO logs_presenca (presenca_id, medico_id, acao, ip_address)
  VALUES (v_presenca_id, v_medico_id, 'checkin', p_ip_address);
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'presenca_id', v_presenca_id,
    'horario_checkin', now(),
    'status', 'presente'
  );
  
  RETURN resultado;
END;
$$;

-- Função para fazer check-out manual
CREATE OR REPLACE FUNCTION public.fazer_checkout_presenca(
  p_presenca_id UUID,
  p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_medico_id UUID;
  resultado JSONB;
BEGIN
  -- Verificar se a presença existe e pertence ao usuário
  SELECT medico_id INTO v_medico_id
  FROM presenca_medico
  WHERE id = p_presenca_id
    AND medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid())
    AND status_presenca = 'presente';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Presença não encontrada ou você já fez checkout'
    );
  END IF;
  
  -- Fazer checkout
  UPDATE presenca_medico 
  SET horario_checkout = now(),
      status_presenca = 'checkout_manual',
      observacoes = p_observacoes,
      alerta_ativo = true, -- Ativar alerta vermelho
      updated_at = now()
  WHERE id = p_presenca_id;
  
  -- Log da ação
  INSERT INTO logs_presenca (presenca_id, medico_id, acao, observacoes)
  VALUES (p_presenca_id, v_medico_id, 'checkout_manual', p_observacoes);
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'horario_checkout', now(),
    'status', 'checkout_manual',
    'alerta_ativo', true
  );
  
  RETURN resultado;
END;
$$;

-- Função para checkout automático
CREATE OR REPLACE FUNCTION public.processar_checkout_automatico()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  presenca_record RECORD;
BEGIN
  -- Buscar presenças que devem ser finalizadas automaticamente
  FOR presenca_record IN
    SELECT p.id, p.medico_id, e.data, e.horario_fim
    FROM presenca_medico p
    INNER JOIN escalas_medicas e ON p.escala_id = e.id
    WHERE p.status_presenca = 'presente'
      AND e.data = CURRENT_DATE
      AND (e.horario_fim + INTERVAL '60 minutes') <= CURRENT_TIME
  LOOP
    -- Fazer checkout automático
    UPDATE presenca_medico 
    SET horario_checkout = now(),
        status_presenca = 'checkout_automatico',
        checkout_automatico = true,
        observacoes = 'Checkout automático após 60 minutos do fim do turno',
        updated_at = now()
    WHERE id = presenca_record.id;
    
    -- Log da ação
    INSERT INTO logs_presenca (presenca_id, medico_id, acao, observacoes)
    VALUES (presenca_record.id, presenca_record.medico_id, 'checkout_automatico', 
            'Checkout automático após 60 minutos do fim do turno');
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Função para obter status atual de presença
CREATE OR REPLACE FUNCTION public.obter_status_presenca_atual(p_medico_id UUID DEFAULT NULL)
RETURNS TABLE(
  presenca_id UUID,
  medico_id UUID,
  medico_nome TEXT,
  escala_id UUID,
  data_presenca DATE,
  horario_checkin TIMESTAMP WITH TIME ZONE,
  horario_checkout TIMESTAMP WITH TIME ZONE,
  status_presenca TEXT,
  alerta_ativo BOOLEAN,
  tempo_online INTERVAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as presenca_id,
    p.medico_id,
    m.nome as medico_nome,
    p.escala_id,
    p.data_presenca,
    p.horario_checkin,
    p.horario_checkout,
    p.status_presenca,
    p.alerta_ativo,
    CASE 
      WHEN p.status_presenca = 'presente' THEN 
        now() - p.horario_checkin
      WHEN p.horario_checkout IS NOT NULL THEN 
        p.horario_checkout - p.horario_checkin
      ELSE NULL
    END as tempo_online
  FROM presenca_medico p
  INNER JOIN medicos m ON p.medico_id = m.id
  WHERE p.data_presenca = CURRENT_DATE
    AND (p_medico_id IS NULL OR p.medico_id = p_medico_id)
    AND (
      is_manager_or_admin() OR 
      m.user_id = auth.uid()
    )
  ORDER BY p.horario_checkin DESC;
END;
$$;