-- LIMPEZA COMPLETA - DELETAR TODAS AS TABELAS RELACIONADAS A FATURAMENTO E RELATÓRIOS

-- Deletar tabelas na ordem correta (respeitando foreign keys)
DROP TABLE IF EXISTS emails_cobranca CASCADE;
DROP TABLE IF EXISTS regua_cobranca CASCADE;
DROP TABLE IF EXISTS fatura_itens CASCADE;
DROP TABLE IF EXISTS faturas_geradas CASCADE;
DROP TABLE IF EXISTS faturamento CASCADE;
DROP TABLE IF EXISTS exames_realizados CASCADE;
DROP TABLE IF EXISTS contratos_clientes CASCADE;
DROP TABLE IF EXISTS upload_logs CASCADE;

-- Limpar bucket de storage
DELETE FROM storage.objects WHERE bucket_id = 'uploads';
DELETE FROM storage.objects WHERE bucket_id = 'relatorios-faturamento';

-- Deletar buckets se necessário (opcional)
DELETE FROM storage.buckets WHERE id IN ('uploads', 'relatorios-faturamento');