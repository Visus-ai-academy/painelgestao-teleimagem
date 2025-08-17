-- Corrigir data_referencia para exames processados retroativamente que devem fazer parte de jun/25
UPDATE volumetria_mobilemed 
SET 
  data_referencia = '2025-06-01',
  periodo_referencia = 'jun/25',
  updated_at = now()
WHERE "EMPRESA" = 'CDI.URUACU'
  AND "NOME_PACIENTE" = 'Eber Da Silva Pereira'
  AND "ESTUDO_DESCRICAO" = 'RX TORNOZELO DIREITO'
  AND data_referencia != '2025-06-01';

-- Log da correção para auditoria
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CORRIGIR_DATA_REFERENCIA', 'CDI.URUACU_RX_TORNOZELO', 
        jsonb_build_object('acao', 'corrigir_data_referencia_jun25', 'motivo', 'exame_processado_retroativo'),
        'system', 'info');