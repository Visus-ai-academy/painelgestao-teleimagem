-- Adicionar campo separado para valor do Portal de Laudos
ALTER TABLE parametros_faturamento 
ADD COLUMN IF NOT EXISTS valor_portal_laudos numeric DEFAULT 0;

-- Comentários para documentar os campos
COMMENT ON COLUMN parametros_faturamento.valor_franquia IS 'Valor cobrado pela franquia';
COMMENT ON COLUMN parametros_faturamento.valor_portal_laudos IS 'Valor cobrado pelo Portal de Laudos';
COMMENT ON COLUMN parametros_faturamento.valor_integracao IS 'Valor cobrado pela Integração';

-- Migrar dados existentes: clientes com portal_laudos=true devem ter valor_portal_laudos preenchido
UPDATE parametros_faturamento 
SET valor_portal_laudos = valor_integracao 
WHERE portal_laudos = true AND valor_portal_laudos = 0;