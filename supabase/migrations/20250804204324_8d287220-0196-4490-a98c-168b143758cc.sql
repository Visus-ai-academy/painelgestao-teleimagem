-- Criar estrutura para sistema de faturamento com preços e parâmetros

-- 1. Tabela de preços de serviços por cliente
CREATE TABLE IF NOT EXISTS precos_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  modalidade TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  codigo_servico TEXT,
  valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_urgencia DECIMAL(10,2) NOT NULL DEFAULT 0,
  tipo_preco TEXT NOT NULL DEFAULT 'padrao', -- 'padrao' ou 'cliente_especifico'
  data_inicio_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia DATE,
  aplicar_legado BOOLEAN NOT NULL DEFAULT true,
  aplicar_incremental BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(user_id)
);

-- 2. Tabela de parâmetros de faturamento por cliente
CREATE TABLE IF NOT EXISTS parametros_faturamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  
  -- Integração
  valor_integracao DECIMAL(10,2) DEFAULT 0,
  cobrar_integracao BOOLEAN DEFAULT false,
  
  -- Franquia
  valor_franquia DECIMAL(10,2) DEFAULT 0,
  volume_franquia INTEGER DEFAULT 0,
  frequencia_continua BOOLEAN DEFAULT false,
  frequencia_por_volume BOOLEAN DEFAULT false,
  valor_acima_franquia DECIMAL(10,2) DEFAULT 0,
  aplicar_franquia BOOLEAN DEFAULT false,
  
  -- Urgência
  percentual_urgencia DECIMAL(5,2) DEFAULT 0, -- Percentual adicional para urgência
  aplicar_adicional_urgencia BOOLEAN DEFAULT false,
  
  -- Tipo de cliente
  tipo_cliente TEXT DEFAULT 'CO', -- 'CO' (Com NF) ou 'NC' (Sem NF)
  
  -- Reajuste
  periodicidade_reajuste TEXT DEFAULT 'anual', -- 'mensal', 'trimestral', 'semestral', 'anual'
  data_aniversario_contrato DATE,
  indice_reajuste TEXT DEFAULT 'IPCA', -- 'IPCA', 'IGP-M', 'Fixo'
  percentual_reajuste_fixo DECIMAL(5,2) DEFAULT 0,
  
  -- Controle
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(user_id),
  
  -- Garantir um parâmetro por cliente
  UNIQUE(cliente_id)
);

-- 3. Atualizar tabela de contratos para incluir campos de faturamento
ALTER TABLE contratos_clientes 
ADD COLUMN IF NOT EXISTS tem_precos_configurados BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tem_parametros_configurados BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tipo_cliente TEXT DEFAULT 'CO';

-- 4. Índices para otimização
CREATE INDEX IF NOT EXISTS idx_precos_servicos_cliente ON precos_servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_combinacao ON precos_servicos(modalidade, especialidade, categoria, prioridade);
CREATE INDEX IF NOT EXISTS idx_precos_servicos_vigencia ON precos_servicos(data_inicio_vigencia, data_fim_vigencia);
CREATE INDEX IF NOT EXISTS idx_parametros_faturamento_cliente ON parametros_faturamento(cliente_id);

-- 5. Triggers para atualização automática
CREATE OR REPLACE FUNCTION atualizar_status_configuracao_contrato() 
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar flag de preços configurados
  UPDATE contratos_clientes 
  SET tem_precos_configurados = EXISTS (
    SELECT 1 FROM precos_servicos 
    WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id) 
    AND ativo = true
  )
  WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  
  -- Atualizar flag de parâmetros configurados
  UPDATE contratos_clientes 
  SET tem_parametros_configurados = EXISTS (
    SELECT 1 FROM parametros_faturamento 
    WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id) 
    AND ativo = true
  )
  WHERE cliente_id = COALESCE(NEW.cliente_id, OLD.cliente_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;