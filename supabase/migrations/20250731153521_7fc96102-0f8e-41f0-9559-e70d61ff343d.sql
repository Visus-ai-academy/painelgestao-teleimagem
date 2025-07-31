-- Adicionar mapeamento para "Urgência" (primeira letra maiúscula)
INSERT INTO valores_prioridade_de_para (prioridade_original, nome_final, ativo)
VALUES ('Urgência', 'URGÊNCIA', true)
ON CONFLICT (prioridade_original) DO UPDATE SET
  nome_final = EXCLUDED.nome_final,
  ativo = EXCLUDED.ativo;

-- Aplicar o de-para novamente
SELECT aplicar_de_para_prioridade();