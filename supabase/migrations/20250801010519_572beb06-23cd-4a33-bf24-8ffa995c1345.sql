-- Criar apenas as estruturas que não existem
CREATE TABLE IF NOT EXISTS tipos_ausencia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#ef4444',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

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

-- Inserir dados padrão apenas se não existirem
INSERT INTO tipos_ausencia (nome, descricao, cor) 
SELECT 'Férias', 'Período de férias', '#3b82f6'
WHERE NOT EXISTS (SELECT 1 FROM tipos_ausencia WHERE nome = 'Férias');

INSERT INTO tipos_ausencia (nome, descricao, cor) 
SELECT 'Licença Médica', 'Licença por motivos de saúde', '#dc2626'
WHERE NOT EXISTS (SELECT 1 FROM tipos_ausencia WHERE nome = 'Licença Médica');

INSERT INTO configuracoes_escala (dia_envio_email, meses_antecipacao) 
SELECT 25, 6
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_escala LIMIT 1);