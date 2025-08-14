-- Adicionar campos faltantes na tabela clientes para o novo cadastro
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS nome_fantasia text,
ADD COLUMN IF NOT EXISTS nome_mobilemed text,
ADD COLUMN IF NOT EXISTS numero_contrato text,
ADD COLUMN IF NOT EXISTS razao_social text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS email_envio_nf text,
ADD COLUMN IF NOT EXISTS dia_faturamento integer,
ADD COLUMN IF NOT EXISTS data_inicio_contrato date,
ADD COLUMN IF NOT EXISTS data_termino_contrato date,
ADD COLUMN IF NOT EXISTS integracao text,
ADD COLUMN IF NOT EXISTS portal_laudos boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS possui_franquia boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS valor_franquia numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS frequencia_continua boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS frequencia_por_volume boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS volume_franquia integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_franquia_acima_volume numeric DEFAULT 0;

-- Migrar dados existentes: nome vai para nome_mobilemed e contato vai para nome_fantasia
UPDATE public.clientes 
SET nome_mobilemed = nome,
    nome_fantasia = contato
WHERE nome_mobilemed IS NULL OR nome_fantasia IS NULL;

-- Comentar as funções antigas de normalização que não serão mais necessárias
-- A função limpar_nome_cliente() será mantida mas não aplicada automaticamente
-- A função normalizar_clientes_cedi() não será mais necessária

COMMENT ON FUNCTION public.limpar_nome_cliente(text) IS 'DESABILITADA - Função antiga de limpeza de nomes. Novo cadastro já vem normalizado.';
COMMENT ON FUNCTION public.normalizar_clientes_cedi() IS 'DESABILITADA - Função antiga de normalização CEDI. Novo cadastro já vem normalizado.';

-- Desabilitar trigger que aplicava limpeza automática de nomes
DROP TRIGGER IF EXISTS trigger_limpar_nome_cliente_insert ON public.volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_limpar_nome_cliente_update ON public.volumetria_mobilemed;

-- Criar índices para os novos campos importantes
CREATE INDEX IF NOT EXISTS idx_clientes_nome_mobilemed ON public.clientes(nome_mobilemed);
CREATE INDEX IF NOT EXISTS idx_clientes_nome_fantasia ON public.clientes(nome_fantasia);
CREATE INDEX IF NOT EXISTS idx_clientes_numero_contrato ON public.clientes(numero_contrato);

-- Log da migração
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('clientes', 'MIGRATION', 'novo_cadastro_clientes', 
        jsonb_build_object('campos_adicionados', array[
          'nome_fantasia', 'nome_mobilemed', 'numero_contrato', 'razao_social',
          'bairro', 'cep', 'email_envio_nf', 'dia_faturamento', 'data_inicio_contrato',
          'data_termino_contrato', 'integracao', 'portal_laudos', 'possui_franquia',
          'valor_franquia', 'frequencia_continua', 'frequencia_por_volume',
          'volume_franquia', 'valor_franquia_acima_volume'
        ]),
        'observacao', 'Migração para suportar novo cadastro de clientes com campos completos'),
        'system', 'info');