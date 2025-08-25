-- CENÁRIO 2: LIMPEZA COMPLETA DE TRIGGERS E FUNÇÕES DUPLICADAS
-- Remover funções SQL órfãs que não são mais utilizadas pelos triggers

-- 1. REMOVER FUNÇÕES DE REGRAS ÓRFÃS
DROP FUNCTION IF EXISTS public.aplicar_regras_automaticas_volumetria();
DROP FUNCTION IF EXISTS public.aplicar_regras_exclusao_dinamicas();
DROP FUNCTION IF EXISTS public.aplicar_regras_periodo_atual();
DROP FUNCTION IF EXISTS public.aplicar_regras_retroativas();

-- 2. REMOVER FUNÇÕES DE QUEBRA ÓRFÃS
DROP FUNCTION IF EXISTS public.aplicar_quebra_exames();
DROP FUNCTION IF EXISTS public.aplicar_quebra_exames_processamento(volumetria_mobilemed);

-- 3. REMOVER FUNÇÕES TRIGGER DUPLICADAS/NÃO UTILIZADAS
DROP FUNCTION IF EXISTS public.aplicar_categorias_trigger();
DROP FUNCTION IF EXISTS public.aplicar_categoria_trigger();
DROP FUNCTION IF EXISTS public.aplicar_correcao_modalidades();
DROP FUNCTION IF EXISTS public.aplicar_de_para_trigger();
DROP FUNCTION IF EXISTS public.aplicar_de_para_prioridade_trigger();

-- 4. MANTER APENAS FUNÇÕES ESSENCIAIS PARA O TRIGGER PRINCIPAL
-- (trigger_aplicar_regras_completas já usa todas as lógicas necessárias internamente)

-- 5. Log da limpeza
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema_limpeza', 'DELETE', 'funcoes_duplicadas', 
        jsonb_build_object(
          'acao', 'Limpeza completa de funções órfãs',
          'funcoes_removidas', ARRAY[
            'aplicar_regras_automaticas_volumetria',
            'aplicar_regras_exclusao_dinamicas',
            'aplicar_regras_periodo_atual',
            'aplicar_regras_retroativas',
            'aplicar_quebra_exames',
            'aplicar_quebra_exames_processamento',
            'aplicar_categorias_trigger',
            'aplicar_categoria_trigger',
            'aplicar_correcao_modalidades',
            'aplicar_de_para_trigger',
            'aplicar_de_para_prioridade_trigger'
          ],
          'beneficios', ARRAY[
            'Remove duplicação de lógica',
            'Reduz confusão conceitual', 
            'Libera recursos do banco',
            'Mantém apenas trigger_aplicar_regras_completas'
          ]
        ),
        'system', 'critical');