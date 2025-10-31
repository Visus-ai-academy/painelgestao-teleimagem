-- Tabela para armazenar valores adicionais dos médicos por período
CREATE TABLE IF NOT EXISTS medicos_valores_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL, -- formato YYYY-MM
  data_adicional DATE NOT NULL,
  valor_adicional NUMERIC(10,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Garantir unicidade por médico + período + data
  UNIQUE(medico_id, periodo, data_adicional)
);

-- Índices para melhor performance
CREATE INDEX idx_medicos_adicionais_medico ON medicos_valores_adicionais(medico_id);
CREATE INDEX idx_medicos_adicionais_periodo ON medicos_valores_adicionais(periodo);

-- RLS policies
ALTER TABLE medicos_valores_adicionais ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar tudo
CREATE POLICY "Admins podem gerenciar valores adicionais"
  ON medicos_valores_adicionais
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Managers podem visualizar
CREATE POLICY "Managers podem ver valores adicionais"
  ON medicos_valores_adicionais
  FOR SELECT
  USING (is_manager_or_admin(auth.uid()));

-- Médicos podem ver seus próprios adicionais
CREATE POLICY "Médicos podem ver seus adicionais"
  ON medicos_valores_adicionais
  FOR SELECT
  USING (
    medico_id IN (
      SELECT id FROM medicos WHERE user_id = auth.uid()
    )
  );

-- Tabela para status de geração de demonstrativos/relatórios de repasse
CREATE TABLE IF NOT EXISTS relatorios_repasse_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  medico_nome TEXT NOT NULL,
  periodo TEXT NOT NULL, -- formato YYYY-MM
  demonstrativo_gerado BOOLEAN DEFAULT false,
  relatorio_gerado BOOLEAN DEFAULT false,
  email_enviado BOOLEAN DEFAULT false,
  omie_conta_gerada BOOLEAN DEFAULT false,
  email_destino TEXT,
  link_relatorio TEXT,
  erro TEXT,
  erro_email TEXT,
  data_processamento TIMESTAMPTZ,
  data_geracao_relatorio TIMESTAMPTZ,
  data_envio_email TIMESTAMPTZ,
  data_geracao_conta_omie TIMESTAMPTZ,
  omie_codigo_conta TEXT,
  detalhes_relatorio JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(medico_id, periodo)
);

-- Índices
CREATE INDEX idx_relatorios_repasse_medico ON relatorios_repasse_status(medico_id);
CREATE INDEX idx_relatorios_repasse_periodo ON relatorios_repasse_status(periodo);

-- RLS policies
ALTER TABLE relatorios_repasse_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar status repasse"
  ON relatorios_repasse_status
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Managers podem ver status repasse"
  ON relatorios_repasse_status
  FOR SELECT
  USING (is_manager_or_admin(auth.uid()));

CREATE POLICY "Médicos podem ver seu status repasse"
  ON relatorios_repasse_status
  FOR SELECT
  USING (
    medico_id IN (
      SELECT id FROM medicos WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_medicos_adicionais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_medicos_adicionais_timestamp
  BEFORE UPDATE ON medicos_valores_adicionais
  FOR EACH ROW
  EXECUTE FUNCTION update_medicos_adicionais_updated_at();

CREATE TRIGGER update_relatorios_repasse_timestamp
  BEFORE UPDATE ON relatorios_repasse_status
  FOR EACH ROW
  EXECUTE FUNCTION update_medicos_adicionais_updated_at();