-- Renomear tabelas e ajustar terminologia de presença para ativação
ALTER TABLE presenca_medico RENAME TO ativacao_medico;
ALTER TABLE logs_presenca RENAME TO logs_ativacao;

-- Renomear colunas para nova terminologia
ALTER TABLE ativacao_medico RENAME COLUMN data_presenca TO data_ativacao;
ALTER TABLE ativacao_medico RENAME COLUMN status_presenca TO status_ativacao;

-- Atualizar valores dos status
UPDATE ativacao_medico SET status_ativacao = 'ativo' WHERE status_ativacao = 'presente';
UPDATE ativacao_medico SET status_ativacao = 'checkout_manual' WHERE status_ativacao = 'checkout_manual';
UPDATE ativacao_medico SET status_ativacao = 'checkout_automatico' WHERE status_ativacao = 'checkout_automatico';

-- Renomear coluna em logs_ativacao
ALTER TABLE logs_ativacao RENAME COLUMN presenca_id TO ativacao_id;

-- Atualizar referência foreign key
ALTER TABLE logs_ativacao DROP CONSTRAINT IF EXISTS logs_presenca_presenca_id_fkey;
ALTER TABLE logs_ativacao ADD CONSTRAINT logs_ativacao_ativacao_id_fkey 
  FOREIGN KEY (ativacao_id) REFERENCES ativacao_medico(id);

-- Renomear e recriar função de checkin
DROP FUNCTION IF EXISTS fazer_checkin_presenca(uuid, inet, jsonb);
CREATE OR REPLACE FUNCTION public.fazer_checkin_ativacao(p_escala_id uuid, p_ip_address inet DEFAULT NULL::inet, p_dispositivo_info jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_medico_id UUID;
  v_data_escala DATE;
  v_horario_inicio TIME;
  v_horario_fim TIME;
  v_ativacao_id UUID;
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
  
  -- Verificar se já existe ativação para hoje
  SELECT id INTO v_ativacao_id
  FROM ativacao_medico
  WHERE medico_id = v_medico_id 
    AND escala_id = p_escala_id
    AND data_ativacao = CURRENT_DATE;
  
  -- Se já existe, fazer update
  IF v_ativacao_id IS NOT NULL THEN
    UPDATE ativacao_medico 
    SET horario_checkin = now(),
        status_ativacao = 'ativo',
        alerta_ativo = false,
        ip_address = p_ip_address,
        dispositivo_info = p_dispositivo_info,
        updated_at = now()
    WHERE id = v_ativacao_id;
  ELSE
    -- Criar nova ativação
    INSERT INTO ativacao_medico (
      medico_id, escala_id, data_ativacao, horario_checkin, 
      status_ativacao, ip_address, dispositivo_info
    ) VALUES (
      v_medico_id, p_escala_id, CURRENT_DATE, now(),
      'ativo', p_ip_address, p_dispositivo_info
    ) RETURNING id INTO v_ativacao_id;
  END IF;
  
  -- Log da ação
  INSERT INTO logs_ativacao (ativacao_id, medico_id, acao, ip_address)
  VALUES (v_ativacao_id, v_medico_id, 'checkin', p_ip_address);
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'ativacao_id', v_ativacao_id,
    'horario_checkin', now(),
    'status', 'ativo'
  );
  
  RETURN resultado;
END;
$function$;

-- Renomear e recriar função de checkout
DROP FUNCTION IF EXISTS fazer_checkout_presenca(uuid, text);
CREATE OR REPLACE FUNCTION public.fazer_checkout_ativacao(p_ativacao_id uuid, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_medico_id UUID;
  resultado JSONB;
BEGIN
  -- Verificar se a ativação existe e pertence ao usuário
  SELECT medico_id INTO v_medico_id
  FROM ativacao_medico
  WHERE id = p_ativacao_id
    AND medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid())
    AND status_ativacao = 'ativo';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Ativação não encontrada ou você já fez checkout'
    );
  END IF;
  
  -- Fazer checkout
  UPDATE ativacao_medico 
  SET horario_checkout = now(),
      status_ativacao = 'checkout_manual',
      observacoes = p_observacoes,
      alerta_ativo = true, -- Ativar alerta vermelho
      updated_at = now()
  WHERE id = p_ativacao_id;
  
  -- Log da ação
  INSERT INTO logs_ativacao (ativacao_id, medico_id, acao, observacoes)
  VALUES (p_ativacao_id, v_medico_id, 'checkout_manual', p_observacoes);
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'horario_checkout', now(),
    'status', 'checkout_manual',
    'alerta_ativo', true
  );
  
  RETURN resultado;
END;
$function$;

-- Renomear e recriar função de obter status
DROP FUNCTION IF EXISTS obter_status_presenca_atual(uuid);
CREATE OR REPLACE FUNCTION public.obter_status_ativacao_atual(p_medico_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(ativacao_id uuid, medico_id uuid, medico_nome text, escala_id uuid, data_ativacao date, horario_checkin timestamp with time zone, horario_checkout timestamp with time zone, status_ativacao text, alerta_ativo boolean, tempo_online interval)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as ativacao_id,
    a.medico_id,
    m.nome as medico_nome,
    a.escala_id,
    a.data_ativacao,
    a.horario_checkin,
    a.horario_checkout,
    a.status_ativacao,
    a.alerta_ativo,
    CASE 
      WHEN a.status_ativacao = 'ativo' THEN 
        now() - a.horario_checkin
      WHEN a.horario_checkout IS NOT NULL THEN 
        a.horario_checkout - a.horario_checkin
      ELSE NULL
    END as tempo_online
  FROM ativacao_medico a
  INNER JOIN medicos m ON a.medico_id = m.id
  WHERE a.data_ativacao = CURRENT_DATE
    AND (p_medico_id IS NULL OR a.medico_id = p_medico_id)
    AND (
      is_manager_or_admin() OR 
      m.user_id = auth.uid()
    )
  ORDER BY a.horario_checkin DESC;
END;
$function$;

-- Atualizar função de checkout automático
CREATE OR REPLACE FUNCTION public.processar_checkout_automatico()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER := 0;
  ativacao_record RECORD;
BEGIN
  -- Buscar ativações que devem ser finalizadas automaticamente
  FOR ativacao_record IN
    SELECT a.id, a.medico_id, e.data, e.horario_fim
    FROM ativacao_medico a
    INNER JOIN escalas_medicas e ON a.escala_id = e.id
    WHERE a.status_ativacao = 'ativo'
      AND e.data = CURRENT_DATE
      AND (e.horario_fim + INTERVAL '60 minutes') <= CURRENT_TIME
  LOOP
    -- Fazer checkout automático
    UPDATE ativacao_medico 
    SET horario_checkout = now(),
        status_ativacao = 'checkout_automatico',
        checkout_automatico = true,
        observacoes = 'Checkout automático após 60 minutos do fim do turno',
        updated_at = now()
    WHERE id = ativacao_record.id;
    
    -- Log da ação
    INSERT INTO logs_ativacao (ativacao_id, medico_id, acao, observacoes)
    VALUES (ativacao_record.id, ativacao_record.medico_id, 'checkout_automatico', 
            'Checkout automático após 60 minutos do fim do turno');
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;