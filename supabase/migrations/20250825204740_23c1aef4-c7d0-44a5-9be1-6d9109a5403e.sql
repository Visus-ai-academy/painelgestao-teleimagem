-- Corrigir constraint audit_logs para permitir operações de limpeza
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_operation_check;

-- Adicionar nova constraint que inclui as operações de limpeza
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_operation_check 
CHECK (operation IN (
  'INSERT', 'UPDATE', 'DELETE', 
  'QUEBRA_AUTOMATICA', 'REGRA_APLICADA', 'LIMPEZA_CACHE',
  'LIMPEZA_FICTICIOS', 'LIMPEZA_DADOS', 'FECHAR_PERIODO', 'REABRIR_PERIODO',
  'EXCLUSAO_AUTOMATICA', 'CORRECAO_AUTOMATICA', 'PROCESSAMENTO_COMPLETO'
));