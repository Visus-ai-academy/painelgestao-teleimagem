
-- ❌ REMOVER TRIGGER E FUNÇÃO QUE APLICAM TIPIFICAÇÃO INCORRETA
-- Este trigger estava confundindo CATEGORIA/MODALIDADE/PRIORIDADE com tipo_faturamento
-- Tipos de faturamento válidos: CO-FT, CO-NF, NC-FT, NC-NF, NC1-NF

-- Remover função com CASCADE para remover todos os triggers dependentes
DROP FUNCTION IF EXISTS aplicar_tipificacao_faturamento() CASCADE;

-- ✅ LIMPAR REGISTROS COM TIPIFICAÇÃO INCORRETA
UPDATE volumetria_mobilemed
SET tipo_faturamento = NULL,
    updated_at = NOW()
WHERE tipo_faturamento IN ('alta_complexidade', 'padrao', 'oncologia', 'urgencia');