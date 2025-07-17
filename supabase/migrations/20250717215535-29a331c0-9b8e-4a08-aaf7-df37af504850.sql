-- Limpar dados antigos primeiro
DELETE FROM faturamento;

-- Inserir dados de faturamento para teste
INSERT INTO faturamento (nome, quantidade, valor_bruto, data_emissao, numero_fatura, periodo)
VALUES
  ('AKCPALMAS', 25, 12500.00, CURRENT_DATE, 'FAT-AKC-2025-07', '2025-07'),
  ('BIOCARDIOS', 32, 18600.00, CURRENT_DATE, 'FAT-BIO-2025-07', '2025-07'),
  ('VILARICA', 18, 8200.00, CURRENT_DATE, 'FAT-VIL-2025-07', '2025-07');