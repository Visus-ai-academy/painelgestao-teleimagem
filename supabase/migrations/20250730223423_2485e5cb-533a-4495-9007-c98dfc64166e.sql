-- Limpar completamente os dados de volumetria mobilemed
DELETE FROM volumetria_mobilemed;

-- Limpar status de uploads de volumetria
DELETE FROM processamento_uploads 
WHERE tipo_arquivo IN (
  'volumetria_padrao', 
  'volumetria_fora_padrao', 
  'volumetria_padrao_retroativo', 
  'volumetria_fora_padrao_retroativo',
  'data_laudo',
  'data_exame',
  'volumetria_onco_padrao'
);

-- Limpar valores de referência de-para
DELETE FROM valores_referencia_de_para;

-- Criar tabela para controle de uploads de arquivos de exames fora de padrão se não existir
CREATE TABLE IF NOT EXISTS uploads_exames_fora_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando',
  registros_processados INTEGER DEFAULT 0,
  registros_inseridos INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  detalhes_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS para uploads_exames_fora_padrao
ALTER TABLE uploads_exames_fora_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar uploads exames fora padrão"
ON uploads_exames_fora_padrao
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver uploads exames fora padrão"
ON uploads_exames_fora_padrao
FOR SELECT
USING (is_manager_or_admin());