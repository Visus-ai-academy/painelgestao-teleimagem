-- =============================================
-- SISTEMA COORDENADO: TRIGGER + EDGE FUNCTIONS
-- =============================================

-- 1. Primeiro vamos garantir que apenas um trigger básico funcione
DROP TRIGGER IF EXISTS trigger_aplicar_regras_completas ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;
DROP TRIGGER IF EXISTS trigger_quebra_automatica ON volumetria_mobilemed;

-- 2. Criar função trigger otimizada para APENAS regras básicas
CREATE OR REPLACE FUNCTION aplicar_regras_basicas_trigger()
RETURNS TRIGGER AS $$
DECLARE
  nova_prioridade TEXT;
  valor_referencia NUMERIC;
BEGIN
  -- ========================================
  -- REGRAS BÁSICAS (aplicadas para TODOS os uploads)
  -- ========================================
  
  -- 1. Limpeza nome cliente (v022)
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Normalização médico (extra_002)
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Correções modalidade (v026, v030, extra_001)
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
      NEW."MODALIDADE" := 'MG';
    ELSE
      NEW."MODALIDADE" := 'RX';
    END IF;
  END IF;
  
  IF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- 4. Aplicar categorias básicas (v028)
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidades básicas (extra_007)
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      NEW."ESPECIALIDADE" := 'GERAL';
    END IF;
  END IF;

  -- 6. De-Para prioridades (v018)
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  -- 7. De-Para valores zerados (v024)
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE UPPER(TRIM(vr.estudo_descricao)) = UPPER(TRIM(NEW."ESTUDO_DESCRICAO"))
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      NEW."VALORES" := valor_referencia;
    END IF;
  END IF;
  
  -- 8. Tipificação faturamento (f006)
  IF NEW.tipo_faturamento IS NULL OR NEW.tipo_faturamento = '' THEN
    IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
      NEW.tipo_faturamento := 'oncologia';
    ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
      NEW.tipo_faturamento := 'urgencia';
    ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
      NEW.tipo_faturamento := 'alta_complexidade';
    ELSE
      NEW.tipo_faturamento := 'padrao';
    END IF;
  END IF;
  
  -- 9. Garantir data de referência (extra_008)
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := NEW."DATA_REALIZACAO";
  END IF;
  
  -- 10. Marcar para processamento avançado se necessário
  NEW.processamento_pendente := (
    -- Tem quebra de exame pendente?
    EXISTS (SELECT 1 FROM regras_quebra_exames WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true)
    OR
    -- É arquivo retroativo (precisa v002/v003)?
    NEW.arquivo_fonte LIKE '%retroativo%'
    OR
    -- Tem regras de exclusão específicas?
    EXISTS (SELECT 1 FROM regras_exclusao WHERE ativo = true)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar o trigger básico
CREATE TRIGGER trigger_regras_basicas
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_basicas_trigger();

-- 4. Função para marcar registros que precisam de processamento avançado
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

-- 5. Criar trigger AFTER INSERT para fila de processamento avançado
CREATE TRIGGER trigger_fila_processamento
  AFTER INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION marcar_processamento_avancado();

-- 6. Criar tabela de fila de processamento avançado
CREATE TABLE IF NOT EXISTS fila_processamento_avancado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volumetria_id UUID NOT NULL REFERENCES volumetria_mobilemed(id) ON DELETE CASCADE,
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

-- 7. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_processamento_status ON fila_processamento_avancado(status);
CREATE INDEX IF NOT EXISTS idx_fila_processamento_prioridade ON fila_processamento_avancado(prioridade, created_at);
CREATE INDEX IF NOT EXISTS idx_fila_processamento_arquivo ON fila_processamento_avancado(arquivo_fonte);

-- 8. RLS para a fila de processamento
ALTER TABLE fila_processamento_avancado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar fila processamento" ON fila_processamento_avancado
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Sistema pode inserir na fila" ON fila_processamento_avancado
  FOR INSERT WITH CHECK (true);

-- 9. Comentários explicativos
COMMENT ON FUNCTION aplicar_regras_basicas_trigger() IS 
'Aplica apenas regras básicas de normalização e correção ANTES da inserção. Regras complexas são delegadas para edge functions.';

COMMENT ON TABLE fila_processamento_avancado IS 
'Fila para processamento avançado via edge functions após inserção básica via trigger.';

COMMENT ON TRIGGER trigger_regras_basicas ON volumetria_mobilemed IS 
'Trigger BEFORE INSERT - aplica regras básicas (normalização, correções simples, de-para)';

COMMENT ON TRIGGER trigger_fila_processamento ON volumetria_mobilemed IS 
'Trigger AFTER INSERT - marca registros que precisam de processamento avançado via edge functions';