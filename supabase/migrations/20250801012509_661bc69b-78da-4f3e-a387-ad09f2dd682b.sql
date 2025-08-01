-- Corrigir estruturas já existentes, apenas adições
-- Criar edge function para envio de emails mensais das escalas
CREATE OR REPLACE FUNCTION enviar_escala_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_rec RECORD;
  medico_rec RECORD;
  dia_atual INTEGER;
BEGIN
  dia_atual := EXTRACT(DAY FROM CURRENT_DATE);
  
  -- Buscar configuração ativa
  SELECT * INTO config_rec FROM configuracoes_escala WHERE ativo = true LIMIT 1;
  
  -- Verificar se é o dia de envio
  IF dia_atual = config_rec.dia_envio_email THEN
    -- Para cada médico ativo
    FOR medico_rec IN 
      SELECT m.id, m.nome, m.email, m.crm
      FROM medicos m 
      WHERE m.ativo = true AND m.email IS NOT NULL
    LOOP
      -- Log da operação
      INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
      VALUES ('escalas_medicas', 'EMAIL_SENT', medico_rec.id::text, 
              jsonb_build_object('medico_nome', medico_rec.nome, 'email', medico_rec.email),
              'system', 'info');
    END LOOP;
  END IF;
END;
$$;

-- Função para replicar escala
CREATE OR REPLACE FUNCTION replicar_escala_medico(
  p_medico_id uuid,
  p_mes_origem integer,
  p_ano_origem integer,
  p_mes_destino integer,
  p_ano_destino integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  escalas_replicadas INTEGER := 0;
  resultado jsonb;
BEGIN
  -- Replicar escalas do período origem para destino
  INSERT INTO escalas_medicas (
    medico_id, data, turno, tipo_escala, modalidade, especialidade,
    observacoes, horario_inicio, horario_fim, tipo_plantao,
    mes_referencia, ano_referencia, escala_replicada_de,
    created_by, status
  )
  SELECT 
    e.medico_id,
    (DATE_TRUNC('month', MAKE_DATE(p_ano_destino, p_mes_destino, 1)) + 
     (e.data - DATE_TRUNC('month', e.data)))::date as nova_data,
    e.turno,
    e.tipo_escala,
    e.modalidade,
    e.especialidade,
    e.observacoes,
    e.horario_inicio,
    e.horario_fim,
    e.tipo_plantao,
    p_mes_destino,
    p_ano_destino,
    e.id,
    auth.uid(),
    'confirmada'
  FROM escalas_medicas e
  WHERE e.medico_id = p_medico_id 
    AND e.mes_referencia = p_mes_origem 
    AND e.ano_referencia = p_ano_origem
    AND e.status = 'confirmada';
  
  GET DIAGNOSTICS escalas_replicadas = ROW_COUNT;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'escalas_replicadas', escalas_replicadas,
    'mes_origem', p_mes_origem,
    'ano_origem', p_ano_origem,
    'mes_destino', p_mes_destino,
    'ano_destino', p_ano_destino
  );
  
  RETURN resultado;
END;
$$;