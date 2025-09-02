-- Remover implementações desnecessárias antigas
DROP TABLE IF EXISTS regras_tasks CASCADE;
DROP FUNCTION IF EXISTS processar_regras_background() CASCADE;
DROP TRIGGER IF EXISTS trigger_aplicar_regras_pos_upload ON processamento_uploads CASCADE;

-- Criar trigger simples que aplica regras automaticamente
CREATE OR REPLACE FUNCTION aplicar_regras_automatico()
RETURNS TRIGGER AS $$
BEGIN
  -- Só aplicar quando status muda para 'concluido'
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    -- Verificar se é arquivo que precisa de regras
    IF NEW.tipo_arquivo IN ('volumetria_padrao', 'volumetria_fora_padrao', 'volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo', 'volumetria_onco_padrao') THEN
      
      -- Log no audit_logs
      INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
      VALUES ('processamento_uploads', 'TRIGGER_REGRAS', NEW.id::text, 
              jsonb_build_object('arquivo_fonte', NEW.tipo_arquivo, 'lote_upload', NEW.lote_upload),
              'sistema-automatico', 'info');
      
      -- As regras serão aplicadas pela interface automaticamente via useAutoRegras
      -- Este trigger apenas marca que o processamento foi concluído
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;