-- Limpar logs de upload de cadastro_exames diretamente
DELETE FROM processamento_uploads WHERE tipo_arquivo = 'cadastro_exames';