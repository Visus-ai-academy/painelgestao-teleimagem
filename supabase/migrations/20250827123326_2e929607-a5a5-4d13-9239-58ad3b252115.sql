-- Atualizar constraint para incluir LIMPEZA_COMPLETA e outras operações necessárias
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_operation_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_operation_check 
CHECK (operation = ANY (ARRAY[
  'INSERT'::text, 
  'UPDATE'::text, 
  'DELETE'::text, 
  'QUEBRA_AUTOMATICA'::text, 
  'REGRA_APLICADA'::text, 
  'LIMPEZA_CACHE'::text, 
  'LIMPEZA_FICTICIOS'::text, 
  'LIMPEZA_DADOS'::text, 
  'LIMPEZA_COMPLETA'::text,  -- Novo valor adicionado
  'FECHAR_PERIODO'::text, 
  'REABRIR_PERIODO'::text, 
  'EXCLUSAO_AUTOMATICA'::text, 
  'CORRECAO_AUTOMATICA'::text, 
  'PROCESSAMENTO_COMPLETO'::text
]));