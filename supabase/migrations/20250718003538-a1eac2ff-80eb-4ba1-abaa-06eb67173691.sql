-- Tabela para armazenar valores de repasse médico por combinação
CREATE TABLE medicos_valores_repasse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(medico_id, modalidade, especialidade, prioridade)
);

-- Enable RLS
ALTER TABLE medicos_valores_repasse ENABLE ROW LEVEL SECURITY;

-- Policies para médicos_valores_repasse
CREATE POLICY "Admins podem gerenciar valores repasse" 
ON medicos_valores_repasse 
FOR ALL 
USING (is_admin());

CREATE POLICY "Managers podem ver valores repasse" 
ON medicos_valores_repasse 
FOR SELECT 
USING (is_manager_or_admin());

CREATE POLICY "Médicos podem ver seus próprios valores" 
ON medicos_valores_repasse 
FOR SELECT 
USING (
  medico_id IN (
    SELECT id FROM medicos WHERE user_id = auth.uid()
  )
);

-- Adicionar campos para categoria e especialidades na tabela médicos
ALTER TABLE medicos 
ADD COLUMN categoria TEXT,
ADD COLUMN modalidades TEXT[],
ADD COLUMN especialidades TEXT[];

-- Trigger para updated_at
CREATE TRIGGER update_medicos_valores_repasse_updated_at
  BEFORE UPDATE ON medicos_valores_repasse
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();