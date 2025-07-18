-- Alterar a constraint da tabela medicos para permitir user_id nulo temporariamente
ALTER TABLE public.medicos ALTER COLUMN user_id DROP NOT NULL;

-- Inserir médicos de exemplo
INSERT INTO public.medicos (nome, crm, especialidade, email, telefone, categoria) VALUES
  ('Dr. Carlos Silva', '12345-SP', 'Cardiologia', 'carlos.silva@teleimagem.com', '(11) 99999-1111', 'Pleno'),
  ('Dra. Ana Santos', '23456-SP', 'Radiologia', 'ana.santos@teleimagem.com', '(11) 99999-2222', 'Senior'),
  ('Dr. Pedro Costa', '34567-SP', 'Neurologia', 'pedro.costa@teleimagem.com', '(11) 99999-3333', 'Expert');

-- Inserir valores de repasse para os médicos
INSERT INTO public.medicos_valores_repasse (medico_id, especialidade, modalidade, prioridade, valor) VALUES
  ((SELECT id FROM medicos WHERE nome = 'Dr. Carlos Silva'), 'Cardiologia', 'Radiologia', 'Urgência', 180.00),
  ((SELECT id FROM medicos WHERE nome = 'Dr. Carlos Silva'), 'Cardiologia', 'Radiologia', 'Rotina', 150.00),
  ((SELECT id FROM medicos WHERE nome = 'Dra. Ana Santos'), 'Radiologia', 'Ultrassom', 'Urgência', 220.00),
  ((SELECT id FROM medicos WHERE nome = 'Dra. Ana Santos'), 'Radiologia', 'Ultrassom', 'Rotina', 180.00),
  ((SELECT id FROM medicos WHERE nome = 'Dr. Pedro Costa'), 'Neurologia', 'Ressonância', 'Urgência', 350.00),
  ((SELECT id FROM medicos WHERE nome = 'Dr. Pedro Costa'), 'Neurologia', 'Ressonância', 'Rotina', 300.00);