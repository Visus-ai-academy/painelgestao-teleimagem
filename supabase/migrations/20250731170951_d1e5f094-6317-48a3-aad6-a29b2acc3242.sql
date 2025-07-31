-- Cancelar upload travado atual
UPDATE processamento_uploads 
SET status = 'erro', 
    detalhes_erro = jsonb_build_object('erro', 'Upload travado - cancelado automaticamente', 'timestamp', NOW()::text),
    completed_at = NOW()
WHERE arquivo_nome = 'uploads/volumetria_padrao_1753981663555_relatorio_exames_especialidade_junho_padrao.xlsx' 
  AND status = 'processando';