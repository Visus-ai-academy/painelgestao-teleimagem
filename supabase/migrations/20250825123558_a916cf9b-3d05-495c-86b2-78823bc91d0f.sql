-- CENÁRIO 2: LIMPEZA COMPLETA - CORRIGIDA
-- Primeiro remover triggers dependentes, depois as funções

-- 1. REMOVER TRIGGERS DEPENDENTES
DROP TRIGGER IF EXISTS trigger_aplicar_exclusoes_dinamicas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_regras_automaticas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_de_para ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_categorias ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_aplicar_correcao_modalidades ON volumetria_mobilemed;

-- 2. REMOVER FUNÇÕES DE REGRAS ÓRFÃS
DROP FUNCTION IF EXISTS public.aplicar_regras_automaticas_volumetria();
DROP FUNCTION IF EXISTS public.aplicar_regras_exclusao_dinamicas();
DROP FUNCTION IF EXISTS public.aplicar_regras_periodo_atual();
DROP FUNCTION IF EXISTS public.aplicar_regras_retroativas();

-- 3. REMOVER FUNÇÕES DE QUEBRA ÓRFÃS
DROP FUNCTION IF EXISTS public.aplicar_quebra_exames();
DROP FUNCTION IF EXISTS public.aplicar_quebra_exames_processamento(volumetria_mobilemed);

-- 4. REMOVER FUNÇÕES TRIGGER DUPLICADAS/NÃO UTILIZADAS
DROP FUNCTION IF EXISTS public.aplicar_categorias_trigger();
DROP FUNCTION IF EXISTS public.aplicar_categoria_trigger();
DROP FUNCTION IF EXISTS public.aplicar_correcao_modalidades();
DROP FUNCTION IF EXISTS public.aplicar_de_para_trigger();
DROP FUNCTION IF EXISTS public.aplicar_de_para_prioridade_trigger();

-- 5. VERIFICAR TRIGGERS RESTANTES
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.action_timing
FROM information_schema.triggers t 
WHERE t.event_object_table = 'volumetria_mobilemed' 
  AND t.trigger_schema = 'public';

-- 6. Log da limpeza
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema_limpeza', 'DELETE', 'triggers_e_funcoes_duplicadas', 
        jsonb_build_object(
          'acao', 'Limpeza completa - triggers e funções órfãs removidas',
          'triggers_removidos', ARRAY[
            'trigger_aplicar_exclusoes_dinamicas',
            'trigger_aplicar_regras_automaticas',
            'trigger_aplicar_de_para',
            'trigger_aplicar_categorias',
            'trigger_aplicar_correcao_modalidades'
          ],
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
          'resultado', 'Sistema limpo - apenas trigger_aplicar_regras_completas ativo'
        ),
        'system', 'critical');