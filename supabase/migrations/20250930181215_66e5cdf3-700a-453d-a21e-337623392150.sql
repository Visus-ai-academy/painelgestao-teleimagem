-- Ajustar unicidade para considerar categoria e cliente
ALTER TABLE public.medicos_valores_repasse 
  DROP CONSTRAINT IF EXISTS medicos_valores_repasse_medico_id_modalidade_especialidade__key;

-- Tornar medico_id opcional para permitir repasse genérico (se aplicável)
ALTER TABLE public.medicos_valores_repasse 
  ALTER COLUMN medico_id DROP NOT NULL;

-- Criar nova constraint única incluindo todas as dimensões de negócio
ALTER TABLE public.medicos_valores_repasse
  ADD CONSTRAINT medicos_valores_repasse_unique_combo
  UNIQUE (medico_id, modalidade, especialidade, prioridade, categoria, cliente_id);