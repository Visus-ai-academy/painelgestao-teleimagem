-- Função que aplica regras v002/v003 automaticamente após insert/update em arquivos retroativos
CREATE OR REPLACE FUNCTION public.trigger_auto_aplicar_regras_retroativas()
RETURNS TRIGGER AS $$
DECLARE
  arquivo_is_retroativo BOOLEAN := false;
BEGIN
  -- Verificar se é arquivo retroativo
  IF NEW.arquivo_fonte IN ('volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo') THEN
    arquivo_is_retroativo := true;
  END IF;
  
  -- Se é arquivo retroativo, agendar aplicação automática de regras v002/v003
  if arquivo_is_retroativo THEN
    -- Usar pg_background para executar em background
    PERFORM pg_background_launch(
      'SELECT net.http_post(
        url := ''https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/auto-aplicar-regras-retroativas'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE"}''::jsonb,
        body := ''{"trigger_automatico": true, "arquivo_fonte": "' || NEW.arquivo_fonte || '"}''::jsonb
      );'
    );
    
    -- Log da ação automática
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('volumetria_mobilemed', 'AUTO_REGRAS_RETROATIVAS', NEW.id::text, 
            jsonb_build_object(
              'arquivo_fonte', NEW.arquivo_fonte,
              'acao', 'Agendamento automático de regras v002/v003',
              'timestamp', now()
            ),
            'system', 'info');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa APÓS INSERT (para não interferir no processo de inserção)
CREATE TRIGGER trigger_auto_regras_retroativas
  AFTER INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_aplicar_regras_retroativas();

-- Log da criação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('volumetria_mobilemed', 'CREATE_TRIGGER', 'auto_regras_retroativas', 
        jsonb_build_object(
          'trigger_criado', 'trigger_auto_regras_retroativas',
          'funcao', 'trigger_auto_aplicar_regras_retroativas()',
          'objetivo', 'Aplicar automaticamente regras v002/v003 em arquivos retroativos',
          'execucao', 'AFTER INSERT - não bloqueia o upload',
          'regras_aplicadas', ARRAY['v002', 'v003']
        ),
        'system', 'info');