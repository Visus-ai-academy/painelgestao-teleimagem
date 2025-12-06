-- Adicionar campo para vinculação com cadastro_exames
ALTER TABLE public.valores_referencia_de_para 
ADD COLUMN IF NOT EXISTS cadastro_exame_id UUID REFERENCES public.cadastro_exames(id) ON DELETE SET NULL;

-- Adicionar índice para melhorar performance de joins
CREATE INDEX IF NOT EXISTS idx_valores_referencia_cadastro_exame_id 
ON public.valores_referencia_de_para(cadastro_exame_id);

-- Comentário explicativo
COMMENT ON COLUMN public.valores_referencia_de_para.cadastro_exame_id IS 'Vinculação com cadastro_exames para herdar categoria, modalidade e especialidade';