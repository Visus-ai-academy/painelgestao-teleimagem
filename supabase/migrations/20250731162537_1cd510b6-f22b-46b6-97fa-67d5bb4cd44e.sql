-- Remover constraint antigo e adicionar novo com 'volumetria'
ALTER TABLE processamento_uploads 
DROP CONSTRAINT processamento_uploads_tipo_dados_check;

-- Adicionar novo constraint que inclui 'volumetria'
ALTER TABLE processamento_uploads 
ADD CONSTRAINT processamento_uploads_tipo_dados_check 
CHECK (tipo_dados = ANY (ARRAY['legado'::text, 'incremental'::text, 'volumetria'::text]));