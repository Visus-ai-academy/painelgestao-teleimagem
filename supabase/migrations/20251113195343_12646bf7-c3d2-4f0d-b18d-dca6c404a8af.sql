-- Corrigir tipo_faturamento do cliente RADI-IMAGEM
-- O contrato existe mas o campo tipo_faturamento não está definido

UPDATE contratos_clientes 
SET tipo_faturamento = 'CO-FT'
WHERE cliente_id = 'bab78553-cdbd-4d35-91bb-6492c151b6dd'
AND (tipo_faturamento IS NULL OR tipo_faturamento = '');

-- Atualizar tipificação da volumetria de RADI-IMAGEM para CO-FT
UPDATE volumetria_mobilemed
SET tipo_faturamento = 'CO-FT',
    tipo_cliente = 'CO'
WHERE periodo_referencia = '2025-10'
AND "EMPRESA" = 'RADI-IMAGEM';