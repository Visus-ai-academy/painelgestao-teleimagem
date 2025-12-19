
-- Limpar registros antigos de jun/25 (inativos) da tabela periodo_referencia_ativo
DELETE FROM periodo_referencia_ativo 
WHERE periodo_referencia = 'jun/25' 
  AND ativo = false;
