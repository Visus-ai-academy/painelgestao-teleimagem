-- Adicionar colunas para controle de volume e prioridade plantão na tabela precos_servicos
ALTER TABLE public.precos_servicos 
ADD COLUMN volume_inicial integer,
ADD COLUMN volume_final integer, 
ADD COLUMN volume_total integer,
ADD COLUMN considera_prioridade_plantao boolean DEFAULT false;

-- Adicionar índices para melhor performance nas consultas de volume
CREATE INDEX idx_precos_servicos_volume ON public.precos_servicos (cliente_id, modalidade, especialidade, categoria, prioridade, volume_inicial, volume_final) WHERE ativo = true;

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.precos_servicos.volume_inicial IS 'Volume inicial para aplicação do preço diferenciado';
COMMENT ON COLUMN public.precos_servicos.volume_final IS 'Volume final para aplicação do preço diferenciado (NULL = sem limite)';
COMMENT ON COLUMN public.precos_servicos.volume_total IS 'Volume total de referência';
COMMENT ON COLUMN public.precos_servicos.considera_prioridade_plantao IS 'Se TRUE, exames de prioridade plantão são considerados no cálculo do volume para aplicar faixa de preço';