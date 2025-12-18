
-- Inserir exame ENTERORRESSONANCIA (com dois R's) no cadastro_exames
-- Especialidade: MEDICINA INTERNA, Categoria: ENTERO, Modalidade: MR
INSERT INTO cadastro_exames (nome, modalidade, especialidade, categoria, prioridade, ativo)
VALUES ('ENTERORRESSONANCIA', 'MR', 'MEDICINA INTERNA', 'ENTERO', 'ROTINA', true)
ON CONFLICT DO NOTHING;

-- Atualizar registros existentes na volumetria que têm CATEGORIA NULL
UPDATE volumetria_mobilemed
SET 
  "CATEGORIA" = 'ENTERO',
  "ESPECIALIDADE" = 'MEDICINA INTERNA',
  updated_at = NOW()
WHERE "ESTUDO_DESCRICAO" = 'ENTERORRESSONANCIA' 
  AND ("CATEGORIA" IS NULL OR "CATEGORIA" = '');
