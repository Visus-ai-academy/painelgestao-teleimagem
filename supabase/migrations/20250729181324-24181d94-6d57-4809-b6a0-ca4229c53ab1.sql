-- Limpar modalidades corrompidas e corrigir encoding
DELETE FROM modalidades;

-- Inserir algumas modalidades básicas para teste
INSERT INTO modalidades (nome, ativo) VALUES 
('Radiografia', true),
('Tomografia', true),
('Ressonância Magnética', true),
('Ultrassonografia', true),
('Mamografia', true);