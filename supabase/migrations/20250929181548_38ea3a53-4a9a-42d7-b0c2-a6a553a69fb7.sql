-- Adicionar novos campos à tabela medicos para cadastro completo

-- Adicionar campo CPF (texto, mesmo formato usado em clientes)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Adicionar campo se é sócio (SIM/NÃO)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS socio TEXT CHECK (socio IN ('SIM', 'NÃO'));

-- Adicionar campo função/cargo
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS funcao TEXT;

-- Adicionar campo especialidade de atuação (texto livre)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS especialidade_atuacao TEXT;

-- Adicionar campo equipe
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS equipe TEXT;

-- Adicionar campo acréscimo sem digitador (SIM/NÃO)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS acrescimo_sem_digitador TEXT CHECK (acrescimo_sem_digitador IN ('SIM', 'NÃO'));

COMMENT ON COLUMN medicos.acrescimo_sem_digitador IS 'Indica se o médico recebe acréscimo quando não utiliza digitador (SIM ou NÃO)';

-- Adicionar campo valor adicional sem digitador
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS adicional_valor_sem_digitador NUMERIC(10,2);

COMMENT ON COLUMN medicos.adicional_valor_sem_digitador IS 'Valor adicional quando não utiliza digitador';

-- Adicionar campo nome da empresa do médico
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS nome_empresa TEXT;

COMMENT ON COLUMN medicos.nome_empresa IS 'Nome da empresa a qual o médico pertence e para onde será realizado o pagamento';

-- Adicionar campo CNPJ (texto, mesmo formato usado em clientes)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Adicionar campo optante pelo simples (SIM/NÃO)
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS optante_simples TEXT CHECK (optante_simples IN ('SIM', 'NÃO'));

COMMENT ON COLUMN medicos.optante_simples IS 'Indica se a empresa do médico é optante pelo Simples Nacional (SIM ou NÃO)';

-- Criar índices para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_medicos_cpf ON medicos(cpf);
CREATE INDEX IF NOT EXISTS idx_medicos_cnpj ON medicos(cnpj);
CREATE INDEX IF NOT EXISTS idx_medicos_nome_empresa ON medicos(nome_empresa);
CREATE INDEX IF NOT EXISTS idx_medicos_funcao ON medicos(funcao);
CREATE INDEX IF NOT EXISTS idx_medicos_equipe ON medicos(equipe);

-- Adicionar comentários nas colunas
COMMENT ON COLUMN medicos.cpf IS 'CPF do médico (formato texto)';
COMMENT ON COLUMN medicos.socio IS 'Indica se o médico é sócio (SIM ou NÃO)';
COMMENT ON COLUMN medicos.funcao IS 'Função ou cargo do médico';
COMMENT ON COLUMN medicos.especialidade_atuacao IS 'Especialidade de atuação do médico';
COMMENT ON COLUMN medicos.equipe IS 'Equipe a qual o médico pertence';
COMMENT ON COLUMN medicos.cnpj IS 'CNPJ da empresa do médico (formato texto)';