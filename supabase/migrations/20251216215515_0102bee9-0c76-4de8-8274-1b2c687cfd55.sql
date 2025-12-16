-- Otimizar política RLS para melhor performance
DROP POLICY IF EXISTS "Médicos podem ver seus próprios valores" ON public.medicos_valores_repasse;

CREATE POLICY "Médicos podem ver seus próprios valores"
ON public.medicos_valores_repasse
FOR SELECT
TO authenticated
USING (medico_id = (select auth.uid()));

-- Criar índice para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_medicos_valores_repasse_medico_id
ON public.medicos_valores_repasse (medico_id);