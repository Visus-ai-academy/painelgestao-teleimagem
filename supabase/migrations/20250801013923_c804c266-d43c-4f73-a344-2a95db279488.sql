-- Criar sistema de cobertura de escalas
CREATE TABLE IF NOT EXISTS coberturas_escala (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_original_id uuid NOT NULL REFERENCES escalas_medicas(id) ON DELETE CASCADE,
  medico_ofereceu_id uuid NOT NULL REFERENCES medicos(id),
  medico_aceitou_id uuid REFERENCES medicos(id),
  data_disponibilizacao timestamp with time zone NOT NULL DEFAULT now(),
  data_aceite timestamp with time zone,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'aceita', 'cancelada', 'expirada')),
  motivo_oferecimento text,
  observacoes text,
  data_inicio_cobertura date NOT NULL,
  data_fim_cobertura date NOT NULL,
  tipo_cobertura text NOT NULL DEFAULT 'dia' CHECK (tipo_cobertura IN ('dia', 'periodo')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE coberturas_escala ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para coberturas_escala
CREATE POLICY "Médicos podem ver coberturas relacionadas a eles" ON coberturas_escala
  FOR SELECT USING (
    medico_ofereceu_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) OR
    medico_aceitou_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) OR
    is_manager_or_admin()
  );

CREATE POLICY "Médicos podem oferecer suas escalas" ON coberturas_escala
  FOR INSERT WITH CHECK (
    medico_ofereceu_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) AND
    -- Validar se está entre 7 e 60 dias antes
    data_inicio_cobertura >= CURRENT_DATE + INTERVAL '7 days' AND
    data_inicio_cobertura <= CURRENT_DATE + INTERVAL '60 days'
  );

CREATE POLICY "Médicos podem aceitar coberturas" ON coberturas_escala
  FOR UPDATE USING (
    status = 'disponivel' AND
    medico_ofereceu_id != (SELECT id FROM medicos WHERE user_id = auth.uid()) AND
    -- Validar se ainda está dentro do prazo de aceite (5 dias antes)
    data_inicio_cobertura >= CURRENT_DATE + INTERVAL '5 days'
  );

CREATE POLICY "Admins podem gerenciar todas coberturas" ON coberturas_escala
  FOR ALL USING (is_manager_or_admin());

-- Função para oferecer escala para cobertura
CREATE OR REPLACE FUNCTION oferecer_escala_cobertura(
  p_escala_id uuid,
  p_medico_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_motivo text DEFAULT NULL,
  p_tipo_cobertura text DEFAULT 'dia'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  dias_antecedencia INTEGER;
  resultado jsonb;
BEGIN
  -- Calcular dias de antecedência
  dias_antecedencia := p_data_inicio - CURRENT_DATE;
  
  -- Validar regras de tempo
  IF dias_antecedencia < 7 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Só é possível oferecer cobertura com no mínimo 7 dias de antecedência'
    );
  END IF;
  
  IF dias_antecedencia > 60 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Só é possível oferecer cobertura com no máximo 60 dias de antecedência'
    );
  END IF;
  
  -- Verificar se já existe cobertura ativa para esta escala
  IF EXISTS (
    SELECT 1 FROM coberturas_escala 
    WHERE escala_original_id = p_escala_id 
      AND status = 'disponivel'
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Esta escala já está disponível para cobertura'
    );
  END IF;
  
  -- Criar cobertura
  INSERT INTO coberturas_escala (
    escala_original_id,
    medico_ofereceu_id,
    motivo_oferecimento,
    data_inicio_cobertura,
    data_fim_cobertura,
    tipo_cobertura,
    created_by
  ) VALUES (
    p_escala_id,
    p_medico_id,
    p_motivo,
    p_data_inicio,
    p_data_fim,
    p_tipo_cobertura,
    auth.uid()
  );
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'dias_antecedencia', dias_antecedencia,
    'data_limite_aceite', p_data_inicio - INTERVAL '5 days'
  );
  
  RETURN resultado;
END;
$$;

-- Função para aceitar cobertura
CREATE OR REPLACE FUNCTION aceitar_cobertura_escala(
  p_cobertura_id uuid,
  p_medico_aceitou_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cobertura_rec RECORD;
  dias_restantes INTEGER;
  resultado jsonb;
BEGIN
  -- Buscar cobertura
  SELECT * INTO cobertura_rec 
  FROM coberturas_escala 
  WHERE id = p_cobertura_id AND status = 'disponivel';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Cobertura não encontrada ou já foi aceita'
    );
  END IF;
  
  -- Calcular dias restantes
  dias_restantes := cobertura_rec.data_inicio_cobertura - CURRENT_DATE;
  
  -- Validar prazo de aceite (5 dias antes)
  IF dias_restantes < 5 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Prazo para aceitar cobertura expirado (mínimo 5 dias antes)'
    );
  END IF;
  
  -- Verificar se o médico não tem escala no mesmo período e especialidade/modalidade
  IF EXISTS (
    SELECT 1 FROM escalas_medicas e1
    INNER JOIN escalas_medicas e2 ON e2.id = cobertura_rec.escala_original_id
    WHERE e1.medico_id = p_medico_aceitou_id
      AND e1.data BETWEEN cobertura_rec.data_inicio_cobertura AND cobertura_rec.data_fim_cobertura
      AND e1.especialidade = e2.especialidade
      AND e1.modalidade = e2.modalidade
      AND e1.turno = e2.turno
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Você já tem escala neste período para a mesma especialidade/modalidade'
    );
  END IF;
  
  -- Aceitar cobertura
  UPDATE coberturas_escala 
  SET medico_aceitou_id = p_medico_aceitou_id,
      data_aceite = now(),
      status = 'aceita'
  WHERE id = p_cobertura_id;
  
  -- Transferir escala para o novo médico
  UPDATE escalas_medicas 
  SET medico_id = p_medico_aceitou_id,
      observacoes = COALESCE(observacoes, '') || ' (Cobertura aceita em ' || to_char(now(), 'DD/MM/YYYY') || ')'
  WHERE id = cobertura_rec.escala_original_id;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'dias_restantes', dias_restantes,
    'escala_transferida', true
  );
  
  RETURN resultado;
END;
$$;

-- Função para listar coberturas disponíveis para um médico
CREATE OR REPLACE FUNCTION listar_coberturas_disponiveis(p_medico_id uuid)
RETURNS TABLE(
  cobertura_id uuid,
  escala_id uuid,
  medico_ofereceu_nome text,
  data_inicio date,
  data_fim date,
  turno text,
  especialidade text,
  modalidade text,
  motivo text,
  dias_restantes_aceite integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cobertura_id,
    e.id as escala_id,
    m.nome as medico_ofereceu_nome,
    c.data_inicio_cobertura as data_inicio,
    c.data_fim_cobertura as data_fim,
    e.turno,
    e.especialidade,
    e.modalidade,
    c.motivo_oferecimento as motivo,
    (c.data_inicio_cobertura - CURRENT_DATE - INTERVAL '5 days')::integer as dias_restantes_aceite
  FROM coberturas_escala c
  INNER JOIN escalas_medicas e ON c.escala_original_id = e.id
  INNER JOIN medicos m ON c.medico_ofereceu_id = m.id
  INNER JOIN medicos m_aceita ON m_aceita.id = p_medico_id
  WHERE c.status = 'disponivel'
    AND c.medico_ofereceu_id != p_medico_id
    AND c.data_inicio_cobertura >= CURRENT_DATE + INTERVAL '5 days'
    AND e.especialidade = ANY(m_aceita.especialidades)
    AND e.modalidade = ANY(m_aceita.modalidades)
    AND NOT EXISTS (
      SELECT 1 FROM escalas_medicas e2 
      WHERE e2.medico_id = p_medico_id
        AND e2.data BETWEEN c.data_inicio_cobertura AND c.data_fim_cobertura
        AND e2.turno = e.turno
    )
  ORDER BY c.data_inicio_cobertura;
END;
$$;

-- Trigger para expirar coberturas automaticamente
CREATE OR REPLACE FUNCTION expirar_coberturas_automaticamente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE coberturas_escala 
  SET status = 'expirada',
      updated_at = now()
  WHERE status = 'disponivel'
    AND data_inicio_cobertura <= CURRENT_DATE + INTERVAL '5 days';
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_coberturas_escala_updated_at
  BEFORE UPDATE ON coberturas_escala
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();