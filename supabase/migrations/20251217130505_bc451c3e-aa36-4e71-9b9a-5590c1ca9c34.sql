-- Criar tabela para armazenar a lista de médicos neurologistas
-- Usada pela regra v034 (aplicar-regra-colunas-musculo-neuro)
CREATE TABLE IF NOT EXISTS public.medicos_neurologistas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  crm text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Comentário na tabela
COMMENT ON TABLE public.medicos_neurologistas IS 'Lista de médicos neurologistas para regra v034 - exames de Coluna laudados por neurologistas são classificados como NEURO + SC';

-- Índices
CREATE INDEX idx_medicos_neurologistas_nome ON public.medicos_neurologistas (nome);
CREATE INDEX idx_medicos_neurologistas_ativo ON public.medicos_neurologistas (ativo);

-- Enable RLS
ALTER TABLE public.medicos_neurologistas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar medicos_neurologistas"
ON public.medicos_neurologistas
FOR ALL
USING (has_role(( SELECT auth.uid() AS uid), 'admin'::app_role));

CREATE POLICY "Managers podem ver medicos_neurologistas"
ON public.medicos_neurologistas
FOR SELECT
USING (has_role(( SELECT auth.uid() AS uid), 'manager'::app_role));

-- Inserir os 42 neurologistas
INSERT INTO public.medicos_neurologistas (nome) VALUES
  ('Amauri Silva Sobrinho'),
  ('Ana Carolina Ottaiano'),
  ('Arthur de Freitas Ferreira'),
  ('Caio Batalha Pereira'),
  ('Carlos Alexandre Martinelli'),
  ('Daniela Cartolano'),
  ('Eduardo Walter Rabelo Arruda'),
  ('Efraim da Silva Ferreira'),
  ('Elton Dias Lopes Barud'),
  ('Eugenio Castro'),
  ('Fábio Sânderson Fernandes'),
  ('Fernanda Veloso Pereira'),
  ('Francisca Rocélia Silva de Freitas'),
  ('Giovanna Martins'),
  ('Gustavo Andreis'),
  ('Gustavo Coutinho Ferreira'),
  ('Heliantho de Siqueira Lima Filho'),
  ('Henrique Bortot Zuppani'),
  ('Jainy Sousa Oliveira'),
  ('James Henrique Yared'),
  ('Jander Luiz Bucker Filho'),
  ('Lara Macatrao Duarte Bacelar'),
  ('Larissa Nara Costa Freitas'),
  ('Luciane Lucas Lucio'),
  ('Luis Filipe Nagata Gasparini'),
  ('Luis Tercio Feitosa Coelho'),
  ('Marcelo Bandeira Filho'),
  ('Marcos Marins'),
  ('Marcus Rogério Lola de Andrade'),
  ('Mariana Helena do Carmo'),
  ('Marilia Assunção Jorge'),
  ('Marlyson Luiz Olivier de Oliveira'),
  ('Otto Wolf Maciel'),
  ('Paulo de Tarso Martins Ribeiro'),
  ('Pericles Moraes Pereira'),
  ('Rafaela Contesini Nivoloni'),
  ('Raissa Nery de Luna Freire Leite'),
  ('Ricardo Jorge Vital'),
  ('Thiago Bezerra Matias'),
  ('Tiago Oliveira Lordelo'),
  ('Tomás Andrade Lourenção Freddi'),
  ('Virgílio de Araújo Oliveira'),
  ('Yuri Aarão Amaral Serruya')
ON CONFLICT (nome) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_medicos_neurologistas_updated_at
  BEFORE UPDATE ON public.medicos_neurologistas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();