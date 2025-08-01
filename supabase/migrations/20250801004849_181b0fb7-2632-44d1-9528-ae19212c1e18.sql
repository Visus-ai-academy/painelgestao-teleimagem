-- Melhorar estrutura da tabela escalas_medicas
ALTER TABLE escalas_medicas 
ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id),
ADD COLUMN IF NOT EXISTS capacidade_maxima_exames integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS preferencias_clientes jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS exclusoes_clientes jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS horario_inicio time,
ADD COLUMN IF NOT EXISTS horario_fim time,
ADD COLUMN IF NOT EXISTS dias_semana integer[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tipo_plantao text CHECK (tipo_plantao IN ('noturno', 'feriado', 'final_semana', 'normal')),
ADD COLUMN IF NOT EXISTS mes_referencia integer,
ADD COLUMN IF NOT EXISTS ano_referencia integer,
ADD COLUMN IF NOT EXISTS escala_replicada_de uuid REFERENCES escalas_medicas(id);

-- Criar tabela para tipos de ausência
CREATE TABLE IF NOT EXISTS tipos_ausencia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#ef4444',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir tipos de ausência padrão
INSERT INTO tipos_ausencia (nome, descricao, cor) VALUES
('Férias', 'Período de férias', '#3b82f6'),
('Licença Médica', 'Licença por motivos de saúde', '#dc2626'),
('Capacitação', 'Treinamento ou capacitação', '#16a34a'),
('Compromisso Pessoal', 'Compromissos pessoais', '#f59e0b'),
('Licença Maternidade/Paternidade', 'Licença por nascimento de filho', '#8b5cf6'),
('Ausência Justificada', 'Outras ausências justificadas', '#6b7280')
ON CONFLICT DO NOTHING;

-- Criar tabela para ausências detalhadas
CREATE TABLE IF NOT EXISTS ausencias_medicas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id uuid NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  tipo_ausencia_id uuid NOT NULL REFERENCES tipos_ausencia(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  turno text CHECK (turno IN ('manha', 'tarde', 'noite', 'dia_inteiro')),
  motivo text,
  aprovado boolean DEFAULT false,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Criar tabela para configurações de escala
CREATE TABLE IF NOT EXISTS configuracoes_escala (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_envio_email integer DEFAULT 25 CHECK (dia_envio_email BETWEEN 1 AND 31),
  meses_antecipacao integer DEFAULT 6 CHECK (meses_antecipacao BETWEEN 1 AND 12),
  capacidade_default_exames integer DEFAULT 50,
  horario_padrao_inicio time DEFAULT '08:00',
  horario_padrao_fim time DEFAULT '18:00',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO configuracoes_escala (dia_envio_email, meses_antecipacao) 
VALUES (25, 6) ON CONFLICT DO NOTHING;

-- Criar tabela para histórico de capacidade produtiva
CREATE TABLE IF NOT EXISTS capacidade_produtiva_medico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id uuid NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  data_calculo date NOT NULL DEFAULT CURRENT_DATE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  total_laudos integer NOT NULL DEFAULT 0,
  media_diaria numeric(10,2) NOT NULL DEFAULT 0,
  capacidade_sugerida integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tipos_ausencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausencias_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacidade_produtiva_medico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tipos_ausencia
CREATE POLICY "Todos podem ver tipos de ausência ativos" ON tipos_ausencia
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins podem gerenciar tipos ausência" ON tipos_ausencia
  FOR ALL USING (is_admin());

-- Políticas RLS para ausencias_medicas
CREATE POLICY "Médicos podem ver suas ausências" ON ausencias_medicas
  FOR SELECT USING (
    medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) OR
    is_manager_or_admin()
  );

CREATE POLICY "Médicos podem criar suas ausências" ON ausencias_medicas
  FOR INSERT WITH CHECK (
    medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid())
  );

CREATE POLICY "Médicos podem editar suas ausências pendentes" ON ausencias_medicas
  FOR UPDATE USING (
    medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) AND aprovado = false
  );

CREATE POLICY "Admins podem gerenciar todas ausências" ON ausencias_medicas
  FOR ALL USING (is_manager_or_admin());

-- Políticas RLS para configuracoes_escala
CREATE POLICY "Todos podem ver configurações ativas" ON configuracoes_escala
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins podem gerenciar configurações" ON configuracoes_escala
  FOR ALL USING (is_admin());

-- Políticas RLS para capacidade_produtiva_medico
CREATE POLICY "Médicos podem ver sua capacidade" ON capacidade_produtiva_medico
  FOR SELECT USING (
    medico_id IN (SELECT id FROM medicos WHERE user_id = auth.uid()) OR
    is_manager_or_admin()
  );

CREATE POLICY "Sistema pode inserir capacidade" ON capacidade_produtiva_medico
  FOR INSERT WITH CHECK (true);

-- Função para calcular capacidade produtiva
CREATE OR REPLACE FUNCTION calcular_capacidade_produtiva(p_medico_id uuid, p_dias integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_laudos integer := 0;
  media_diaria numeric := 0;
  capacidade_sugerida integer := 0;
  periodo_inicio date;
  periodo_fim date;
  resultado jsonb;
BEGIN
  periodo_fim := CURRENT_DATE;
  periodo_inicio := periodo_fim - INTERVAL '1 day' * p_dias;
  
  -- Calcular total de laudos nos últimos X dias (simulado por now)
  -- Aqui seria a integração real com o sistema de laudos
  total_laudos := (random() * 100 + 50)::integer; -- Simulação temporária
  
  media_diaria := total_laudos::numeric / p_dias;
  capacidade_sugerida := (media_diaria * 1.2)::integer; -- 20% acima da média
  
  -- Inserir no histórico
  INSERT INTO capacidade_produtiva_medico (
    medico_id, periodo_inicio, periodo_fim, 
    total_laudos, media_diaria, capacidade_sugerida
  ) VALUES (
    p_medico_id, periodo_inicio, periodo_fim,
    total_laudos, media_diaria, capacidade_sugerida
  );
  
  resultado := jsonb_build_object(
    'total_laudos', total_laudos,
    'media_diaria', media_diaria,
    'capacidade_sugerida', capacidade_sugerida,
    'periodo_inicio', periodo_inicio,
    'periodo_fim', periodo_fim
  );
  
  RETURN resultado;
END;
$$;

-- Triggers para updated_at
CREATE OR REPLACE TRIGGER update_tipos_ausencia_updated_at
  BEFORE UPDATE ON tipos_ausencia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ausencias_medicas_updated_at
  BEFORE UPDATE ON ausencias_medicas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_configuracoes_escala_updated_at
  BEFORE UPDATE ON configuracoes_escala
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();