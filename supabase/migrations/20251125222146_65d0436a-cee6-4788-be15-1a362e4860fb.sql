
-- Corrigir tipo_cliente do RADI-IMAGEM de CO para NC
UPDATE clientes
SET tipo_cliente = 'NC',
    updated_at = NOW()
WHERE nome = 'RADI-IMAGEM' 
  AND tipo_cliente = 'CO';
