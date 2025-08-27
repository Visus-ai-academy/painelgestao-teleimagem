-- Criar job automático para aplicar regras v002/v003 nos arquivos retroativos
-- Este job roda a cada 5 minutos verificando se há arquivos retroativos que precisam de processamento

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função que verifica e aplica regras automaticamente
CREATE OR REPLACE FUNCTION public.verificar_e_aplicar_regras_automaticas()
RETURNS jsonb AS $$
DECLARE
  total_padrao_retroativo INTEGER;
  total_fora_padrao_retroativo INTEGER;
  necessita_aplicacao BOOLEAN := false;
  resultado jsonb;
BEGIN
  -- Contar registros nos arquivos retroativos
  SELECT COUNT(*) INTO total_padrao_retroativo
  FROM volumetria_mobilemed 
  WHERE arquivo_fonte = 'volumetria_padrao_retroativo';
  
  SELECT COUNT(*) INTO total_fora_padrao_retroativo
  FROM volumetria_mobilemed 
  WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo';
  
  -- Verificar se precisa aplicar regras
  -- Padrão retroativo: esperamos ~230 após regras v002/v003
  -- Fora padrão retroativo: esperamos ~0 após regras v002/v003
  IF total_padrao_retroativo > 2300 OR total_fora_padrao_retroativo > 10 THEN
    necessita_aplicacao := true;
    
    -- Aplicar regras chamando a edge function
    SELECT net.http_post(
      url := 'https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/aplicar-exclusoes-periodo',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE"}'::jsonb,
      body := '{"periodo_referencia": "jun/25", "automatico": true}'::jsonb
    ) INTO resultado;
    
  END IF;
  
  RETURN jsonb_build_object(
    'verificacao_executada', now(),
    'padrao_retroativo_registros', total_padrao_retroativo,
    'fora_padrao_retroativo_registros', total_fora_padrao_retroativo,
    'necessitava_aplicacao', necessita_aplicacao,
    'regras_aplicadas', CASE WHEN necessita_aplicacao THEN 'v002,v003' ELSE 'nenhuma' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar execução a cada 5 minutos
SELECT cron.schedule(
  'aplicar-regras-retroativas-automatico',
  '*/5 * * * *', -- a cada 5 minutos
  $$SELECT public.verificar_e_aplicar_regras_automaticas();$$
);

-- Log da criação
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema', 'INSERT', 'cron_regras_automaticas', 
        jsonb_build_object(
          'cron_job_criado', 'aplicar-regras-retroativas-automatico',
          'funcao', 'verificar_e_aplicar_regras_automaticas()',
          'frequencia', 'a cada 5 minutos',
          'objetivo', 'Aplicar automaticamente regras v002/v003 em arquivos retroativos',
          'regras_monitoradas', ARRAY['v002', 'v003']
        ),
        'system', 'info');