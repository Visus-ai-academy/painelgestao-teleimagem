-- Inserir dados de teste na tabela faturamento para AKCPALMAS
INSERT INTO public.faturamento (
  nome, 
  quantidade, 
  valor_bruto, 
  data_emissao,
  numero_fatura,
  periodo
) VALUES 
  ('AKCPALMAS', 5, 1500.00, '2025-07-15', 'FAT-AKC-001', '2025-07'),
  ('AKCPALMAS', 3, 850.00, '2025-07-10', 'FAT-AKC-002', '2025-07'),
  ('BIOCARDIOS', 8, 2200.00, '2025-07-12', 'FAT-BIO-001', '2025-07'),
  ('VILARICA', 4, 1100.00, '2025-07-14', 'FAT-VIL-001', '2025-07');