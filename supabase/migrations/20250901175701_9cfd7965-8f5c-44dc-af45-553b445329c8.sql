-- Verificar se triggers foram criados e funcionam corretamente
-- Criar função de debug para monitorar uploads

-- 1. Verificar se as funções existem
SELECT proname, prosrc FROM pg_proc WHERE proname IN (
  'aplicar_regras_v002_v003_trigger',
  'aplicar_regra_v031_trigger'
);

-- 2. Criar função de debug para uploads
CREATE OR REPLACE FUNCTION debug_upload_volumetria()
RETURNS TRIGGER AS $$
BEGIN
  -- Log todos os inserts na volumetria_mobilemed
  INSERT INTO audit_logs (
    evento_tipo,
    tabela_afetada,
    dados_antes,
    dados_depois,
    usuario_id,
    detalhes
  ) VALUES (
    'DEBUG_UPLOAD',
    'volumetria_mobilemed',
    NULL,
    row_to_json(NEW),
    auth.uid(),
    jsonb_build_object(
      'arquivo_fonte', NEW.arquivo_fonte,
      'data_realizacao', NEW."DATA_REALIZACAO",
      'data_laudo', NEW."DATA_LAUDO",
      'trigger_debug', 'Registro inserido com sucesso'
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger de debug
DROP TRIGGER IF EXISTS trigger_debug_upload ON volumetria_mobilemed;
CREATE TRIGGER trigger_debug_upload
  AFTER INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION debug_upload_volumetria();

-- 4. Verificar se triggers existem
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  tgname
FROM information_schema.triggers t
LEFT JOIN pg_trigger pt ON pt.tgname = t.trigger_name
WHERE event_object_table = 'volumetria_mobilemed';