-- Inserir dados de exemplo na tabela valores_referencia_de_para incluindo TC CRANIO X1
INSERT INTO valores_referencia_de_para (estudo_descricao, valores, ativo) VALUES
('TC CRANIO X1', 85, true),
('TC CRANIO E SEIOS DA FACE X1 X6', 120, true),
('TC CRANIO E COLUNA CERVICAL X1', 150, true),
('TC CRANIO E ANGIO ARTERIAL CRANIO X1', 200, true),
('TC CRANIO E PESCOCO X1 X6', 160, true),
('TC CRANIO E ORBITAS X1 X6', 110, true),
('TC CRANIO E OSSOS TEMPORAIS X1 X6', 130, true),
('TC CRANIO E FACE X1 X6', 140, true),
('TC CRANIO E ANGIO ARTERIAL E VENOSA CRANIO X1', 250, true),
('TC CRANIO E ANGIO VENOSA CRANIO X1', 180, true),
('RX TORAX PA', 45, true),
('RX ABDOME SIMPLES', 50, true),
('USG ABDOME TOTAL', 75, true),
('ELETROCARDIOGRAMA', 25, true),
('MAMOGRAFIA BILATERAL', 90, true);

-- Aplicar valores de referência aos dados existentes
SELECT aplicar_valores_de_para();