-- Criar tabela de mapeamento de nomes de clientes
CREATE TABLE IF NOT EXISTS public.mapeamento_nomes_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo TEXT NOT NULL,
  nome_sistema TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  observacoes TEXT
);

-- Habilitar RLS
ALTER TABLE public.mapeamento_nomes_clientes ENABLE ROW LEVEL SECURITY;

-- Política para admins gerenciarem mapeamentos
CREATE POLICY "Admins podem gerenciar mapeamentos de nomes" 
ON public.mapeamento_nomes_clientes 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Política para managers visualizarem mapeamentos
CREATE POLICY "Managers podem ver mapeamentos de nomes" 
ON public.mapeamento_nomes_clientes 
FOR SELECT 
USING (is_manager_or_admin());

-- Inserir o mapeamento para CARIRI_CLINIMAGEM
INSERT INTO public.mapeamento_nomes_clientes (nome_arquivo, nome_sistema, observacoes)
VALUES ('CARIRI_CLINIMAGEM', 'CLINIMAGEM_CARIRI', 'Mapeamento criado para corrigir diferença de nomes entre arquivo e cadastro');

-- Função para buscar nome correto do cliente
CREATE OR REPLACE FUNCTION public.get_nome_cliente_mapeado(nome_arquivo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  nome_mapeado TEXT;
BEGIN
  -- Buscar mapeamento ativo
  SELECT nome_sistema INTO nome_mapeado
  FROM mapeamento_nomes_clientes
  WHERE nome_arquivo = $1 AND ativo = true
  LIMIT 1;
  
  -- Se encontrou mapeamento, retornar nome do sistema
  IF nome_mapeado IS NOT NULL THEN
    RETURN nome_mapeado;
  END IF;
  
  -- Se não encontrou, retornar nome original
  RETURN nome_arquivo;
END;
$$;