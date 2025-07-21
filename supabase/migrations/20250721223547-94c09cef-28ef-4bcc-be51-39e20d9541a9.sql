-- Verificar estado atual dos dados
SELECT id, nome, ativo, status FROM clientes LIMIT 10;

-- Corrigir inconsistências entre campo ativo e status
UPDATE clientes 
SET status = CASE 
    WHEN ativo = true THEN 'Ativo'
    WHEN ativo = false THEN 'Inativo'
    ELSE 'Ativo'
END;

-- Verificar após correção
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN ativo = true THEN 1 END) as ativos_boolean,
    COUNT(CASE WHEN status = 'Ativo' THEN 1 END) as ativos_status,
    COUNT(CASE WHEN ativo = false THEN 1 END) as inativos_boolean,
    COUNT(CASE WHEN status = 'Inativo' THEN 1 END) as inativos_status
FROM clientes;