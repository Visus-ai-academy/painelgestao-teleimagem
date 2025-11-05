-- Remove coluna valor_urgencia que não é mais utilizada
-- O sistema agora usa apenas valor_base com prioridade

ALTER TABLE precos_servicos 
DROP COLUMN IF EXISTS valor_urgencia;