-- Desativar o cron job de verificação automática a cada 5 minutos
-- Agora as regras v002/v003 serão aplicadas durante o upload dos arquivos retroativos

-- Remover o agendamento do cron job
SELECT cron.unschedule('aplicar-regras-retroativas-automatico');

-- Remover a função que não será mais usada periodicamente
-- Mantemos a função para uso manual se necessário
COMMENT ON FUNCTION public.verificar_e_aplicar_regras_automaticas() IS 'Função desativada - regras são aplicadas automaticamente durante upload';

-- Log da mudança
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema', 'UPDATE', 'cron_regras_desativado', 
        jsonb_build_object(
          'cron_job_removido', 'aplicar-regras-retroativas-automatico',
          'motivo', 'Aplicação de regras migrada para processo de upload',
          'nova_estrategia', 'Aplicar regras v002/v003 automaticamente quando arquivo retroativo é carregado',
          'beneficios', 'Processamento imediato, sem espera de cron job'
        ),
        'system', 'info');