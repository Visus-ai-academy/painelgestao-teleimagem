-- 📊 RELATÓRIO FINAL - Consulta completa do sistema otimizado

-- 1. Status de Segurança
SELECT 'SEGURANÇA' as categoria, 
       'RLS Tables' as metrica, 
       COUNT(*)::text as valor
FROM pg_tables pt
WHERE pt.schemaname = 'public' 
  AND pt.rowsecurity = true

UNION ALL

-- 2. Performance Dashboard
SELECT 'PERFORMANCE' as categoria,
       'Índices Criados' as metrica,
       COUNT(*)::text as valor  
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname LIKE '%_performance_%'

UNION ALL

-- 3. Dados do Sistema
SELECT 'DADOS' as categoria,
       'Clientes Ativos' as metrica,
       COUNT(*)::text as valor
FROM clientes 
WHERE ativo = true

UNION ALL

SELECT 'DADOS' as categoria,
       'Preços Configurados' as metrica,
       COUNT(*)::text as valor
FROM precos_servicos
WHERE ativo = true

UNION ALL

SELECT 'DADOS' as categoria,
       'Registros Volumetria' as metrica,
       COUNT(*)::text as valor
FROM volumetria_mobilemed

UNION ALL

SELECT 'DADOS' as categoria,
       'Perfis Auto-Criados' as metrica,
       COUNT(*)::text as valor
FROM profiles

ORDER BY categoria, metrica;