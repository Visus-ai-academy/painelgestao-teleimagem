-- Adicionar colunas faltantes na tabela medicos_valores_repasse
ALTER TABLE public.medicos_valores_repasse 
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS esta_no_escopo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id),
  ADD COLUMN IF NOT EXISTS data_inicio_vigencia DATE,
  ADD COLUMN IF NOT EXISTS data_fim_vigencia DATE,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_repasse_medico ON medicos_valores_repasse(medico_id);
CREATE INDEX IF NOT EXISTS idx_repasse_cliente ON medicos_valores_repasse(cliente_id);
CREATE INDEX IF NOT EXISTS idx_repasse_modalidade_esp ON medicos_valores_repasse(modalidade, especialidade);
CREATE INDEX IF NOT EXISTS idx_repasse_ativo ON medicos_valores_repasse(ativo) WHERE ativo = true;

-- Comentários
COMMENT ON TABLE medicos_valores_repasse IS 'Valores de repasse médico por modalidade/especialidade/categoria/prioridade/cliente';
COMMENT ON COLUMN medicos_valores_repasse.esta_no_escopo IS 'Indica se o valor está no escopo do contrato do cliente';
COMMENT ON COLUMN medicos_valores_repasse.cliente_id IS 'Cliente específico (NULL = valor geral)';
COMMENT ON COLUMN medicos_valores_repasse.categoria IS 'Categoria do exame (SC, CC, etc)';