-- Apenas as colunas que ainda não existem
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

-- Criar novas tabelas que não existem
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

-- Inserir configuração padrão se não existir
INSERT INTO configuracoes_escala (dia_envio_email, meses_antecipacao) 
VALUES (25, 6) 
ON CONFLICT DO NOTHING;

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
ALTER TABLE ausencias_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacidade_produtiva_medico ENABLE ROW LEVEL SECURITY;