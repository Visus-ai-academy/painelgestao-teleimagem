-- Verificar e inserir se não existir
INSERT INTO valores_prioridade_de_para (prioridade_original, nome_final, ativo)
SELECT 'Urgência', 'URGÊNCIA', true
WHERE NOT EXISTS (
  SELECT 1 FROM valores_prioridade_de_para 
  WHERE prioridade_original = 'Urgência'
);

-- Aplicar o de-para novamente  
SELECT aplicar_de_para_prioridade();