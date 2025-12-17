
-- Criar cliente CEMMIT que está faltando
INSERT INTO public.clientes (nome, nome_mobilemed, nome_fantasia, razao_social, ativo, status)
VALUES ('CEMMIT', 'CEMMIT', 'CEMMIT', 'CEMMIT', true, 'Ativo')
RETURNING id;
