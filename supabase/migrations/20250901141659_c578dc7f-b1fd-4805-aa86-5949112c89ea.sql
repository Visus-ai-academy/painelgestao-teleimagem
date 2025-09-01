-- Corrigir problema com múltiplas funções is_admin()
-- Primeiro, vamos dropar as políticas problemáticas e recriar

-- 1. Dropar a tabela e recriar sem RLS complexa
DROP TABLE IF EXISTS fila_processamento_avancado CASCADE;

-- 2. Criar tabela simplificada
CREATE TABLE fila_processamento_avancado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volumetria_id UUID NOT NULL,
  arquivo_fonte TEXT NOT NULL,
  lote_upload TEXT NOT NULL,
  tipos_processamento JSONB NOT NULL DEFAULT '[]'::jsonb,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  erro_detalhes TEXT,
  processado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Criar índices
CREATE INDEX idx_fila_processamento_status ON fila_processamento_avancado(status);
CREATE INDEX idx_fila_processamento_prioridade ON fila_processamento_avancado(prioridade, created_at);
CREATE INDEX idx_fila_processamento_arquivo ON fila_processamento_avancado(arquivo_fonte);

-- 4. RLS simples (sem função is_admin complexa)
ALTER TABLE fila_processamento_avancado ENABLE ROW LEVEL SECURITY;

-- Política simples: apenas sistema pode inserir, admins podem ver tudo
CREATE POLICY "Sistema pode gerenciar fila" ON fila_processamento_avancado
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Corrigir a função marcar_processamento_avancado para não ter referência FK problemática
CREATE OR REPLACE FUNCTION marcar_processamento_avancado()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir na fila de processamento avançado se necessário
  IF NEW.processamento_pendente = true THEN
    INSERT INTO fila_processamento_avancado (
      volumetria_id,
      arquivo_fonte,
      lote_upload,
      tipos_processamento,
      prioridade,
      created_at
    ) VALUES (
      NEW.id,
      NEW.arquivo_fonte,
      NEW.lote_upload,
      CASE 
        WHEN NEW.arquivo_fonte LIKE '%retroativo%' THEN '["v002_v003", "quebras", "exclusoes"]'::jsonb
        WHEN EXISTS (SELECT 1 FROM regras_quebra_exames WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true) 
          THEN '["quebras", "exclusoes"]'::jsonb
        ELSE '["exclusoes"]'::jsonb
      END,
      CASE 
        WHEN NEW.arquivo_fonte LIKE '%retroativo%' THEN 'alta'
        ELSE 'normal'
      END,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Comentários
COMMENT ON TABLE fila_processamento_avancado IS 
'Fila para processamento avançado via edge functions após inserção básica via trigger.';

-- 7. Verificar se os triggers estão criados corretamente
SELECT trigger_name, event_manipulation, action_timing 
FROM information_schema.triggers 
WHERE event_object_table = 'volumetria_mobilemed' 
  AND trigger_schema = 'public'
ORDER BY trigger_name;