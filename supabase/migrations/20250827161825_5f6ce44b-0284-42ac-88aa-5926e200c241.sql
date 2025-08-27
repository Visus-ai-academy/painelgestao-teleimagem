-- Corrigir a função para sempre aplicar regras v002/v003 em arquivos retroativos
-- Remover critérios baseados em quantidade de registros

CREATE OR REPLACE FUNCTION public.verificar_e_aplicar_regras_automaticas()
RETURNS jsonb AS $$
DECLARE
  total_padrao_retroativo INTEGER;
  total_fora_padrao_retroativo INTEGER;
  resultado jsonb;
  tem_arquivos_retroativos BOOLEAN := false;
BEGIN
  -- Verificar se existem arquivos retroativos (independente da quantidade)
  SELECT COUNT(*) INTO total_padrao_retroativo
  FROM volumetria_mobilemed 
  WHERE arquivo_fonte = 'volumetria_padrao_retroativo';
  
  SELECT COUNT(*) INTO total_fora_padrao_retroativo
  FROM volumetria_mobilemed 
  WHERE arquivo_fonte = 'volumetria_fora_padrao_retroativo';
  
  -- Se existem arquivos retroativos, SEMPRE aplicar as regras v002/v003
  IF total_padrao_retroativo > 0 OR total_fora_padrao_retroativo > 0 THEN
    tem_arquivos_retroativos := true;
    
    -- Aplicar regras v002/v003 SEMPRE, independente da quantidade
    SELECT net.http_post(
      url := 'https://atbvikgxdcohnznkmaus.supabase.co/functions/v1/aplicar-exclusoes-periodo',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0YnZpa2d4ZGNvaG56bmttYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY1MzAsImV4cCI6MjA2ODI3MjUzMH0.P2eptjgahiMcUzE9b1eAVAW1HC9Ib52LYpRAO8S_9CE"}'::jsonb,
      body := '{"periodo_referencia": "jun/25", "automatico": true, "aplicar_sempre": true}'::jsonb
    ) INTO resultado;
    
  END IF;
  
  RETURN jsonb_build_object(
    'verificacao_executada', now(),
    'padrao_retroativo_registros', total_padrao_retroativo,
    'fora_padrao_retroativo_registros', total_fora_padrao_retroativo,
    'tinha_arquivos_retroativos', tem_arquivos_retroativos,
    'regras_aplicadas', CASE WHEN tem_arquivos_retroativos THEN 'v002,v003 - SEMPRE aplicadas' ELSE 'nenhuma - sem arquivos retroativos' END,
    'criterio', 'Aplicação automática para QUALQUER quantidade de registros retroativos'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Log da correção
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema', 'UPDATE', 'cron_regras_corrigido', 
        jsonb_build_object(
          'problema_corrigido', 'Critérios fixos de quantidade removidos',
          'novo_comportamento', 'SEMPRE aplicar regras v002/v003 se existem arquivos retroativos',
          'criterio_anterior', 'Baseado em estimativas de quantidade (incorreto)',
          'criterio_atual', 'Aplicação automática para QUALQUER quantidade',
          'regras_afetadas', ARRAY['v002', 'v003'],
          'arquivos_monitorados', ARRAY['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo']
        ),
        'system', 'info');