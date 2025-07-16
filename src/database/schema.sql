-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    endereco TEXT,
    cnpj VARCHAR(18),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de exames realizados
CREATE TABLE IF NOT EXISTS exames_realizados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente VARCHAR(255) NOT NULL,
    cliente_id UUID REFERENCES clientes(id),
    medico VARCHAR(255) NOT NULL,
    data_exame DATE NOT NULL,
    modalidade VARCHAR(10) NOT NULL, -- MR, CT, DO, MG, RX
    especialidade VARCHAR(10) NOT NULL, -- CA, NE, ME, MI, MA
    categoria VARCHAR(50),
    prioridade VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Realizado',
    valor_bruto DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de contratos e regras de preços
CREATE TABLE IF NOT EXISTS contratos_clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id),
    modalidade VARCHAR(10) NOT NULL,
    especialidade VARCHAR(10) NOT NULL,
    categoria VARCHAR(50),
    prioridade VARCHAR(20),
    valor DECIMAL(10,2) NOT NULL,
    desconto DECIMAL(5,2) DEFAULT 0,
    acrescimo DECIMAL(5,2) DEFAULT 0,
    data_vigencia_inicio DATE NOT NULL,
    data_vigencia_fim DATE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de escalas médicas
CREATE TABLE IF NOT EXISTS escalas_medicas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    medico VARCHAR(255) NOT NULL,
    data_escala DATE NOT NULL,
    turno VARCHAR(20) NOT NULL, -- Manhã, Tarde, Noite
    tipo_escala VARCHAR(20) NOT NULL, -- Plantão, Turno
    modalidade VARCHAR(10) NOT NULL,
    especialidade VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'Presente', -- Presente, Ausente, Pendente
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de faturas geradas
CREATE TABLE IF NOT EXISTS faturas_geradas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero VARCHAR(50) NOT NULL UNIQUE,
    cliente_id UUID REFERENCES clientes(id),
    periodo VARCHAR(10) NOT NULL, -- YYYY-MM
    data_emissao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Gerada', -- Gerada, Enviada, Paga, Vencida
    subtotal DECIMAL(12,2) NOT NULL,
    desconto DECIMAL(12,2) DEFAULT 0,
    acrescimo DECIMAL(12,2) DEFAULT 0,
    valor_total DECIMAL(12,2) NOT NULL,
    observacoes TEXT,
    arquivo_pdf TEXT, -- URL ou caminho do arquivo PDF
    email_enviado BOOLEAN DEFAULT false,
    data_email TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de itens da fatura (detalhe dos exames)
CREATE TABLE IF NOT EXISTS fatura_itens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fatura_id UUID REFERENCES faturas_geradas(id) ON DELETE CASCADE,
    exame_id UUID REFERENCES exames_realizados(id),
    modalidade VARCHAR(10) NOT NULL,
    especialidade VARCHAR(10) NOT NULL,
    categoria VARCHAR(50),
    prioridade VARCHAR(20),
    valor_contrato DECIMAL(10,2) NOT NULL,
    desconto DECIMAL(10,2) DEFAULT 0,
    acrescimo DECIMAL(10,2) DEFAULT 0,
    valor_final DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de logs de upload e processamento
CREATE TABLE IF NOT EXISTS upload_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arquivo_nome VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(50) NOT NULL, -- exames, contratos, escalas, financeiro
    tamanho_bytes BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'Processando', -- Processando, Concluído, Erro
    registros_processados INTEGER DEFAULT 0,
    registros_erro INTEGER DEFAULT 0,
    mensagem_erro TEXT,
    usuario_upload VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_exames_cliente_periodo ON exames_realizados(cliente_id, data_exame);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente ON contratos_clientes(cliente_id, ativo);
CREATE INDEX IF NOT EXISTS idx_escalas_data ON escalas_medicas(data_escala, medico);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_periodo ON faturas_geradas(cliente_id, periodo);

-- RLS (Row Level Security) - Configurar conforme necessário
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exames_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas_geradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar conforme necessário)
CREATE POLICY "Usuários podem ver todos os dados" ON clientes FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON exames_realizados FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON contratos_clientes FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON escalas_medicas FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON faturas_geradas FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON fatura_itens FOR SELECT USING (true);
CREATE POLICY "Usuários podem ver todos os dados" ON upload_logs FOR SELECT USING (true);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exames_realizados_updated_at BEFORE UPDATE ON exames_realizados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contratos_clientes_updated_at BEFORE UPDATE ON contratos_clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalas_medicas_updated_at BEFORE UPDATE ON escalas_medicas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faturas_geradas_updated_at BEFORE UPDATE ON faturas_geradas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_upload_logs_updated_at BEFORE UPDATE ON upload_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();