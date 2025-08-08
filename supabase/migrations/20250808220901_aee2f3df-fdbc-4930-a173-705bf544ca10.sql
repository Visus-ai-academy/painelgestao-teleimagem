-- Tabela de metadados de regras de negócio (para classificação por módulo no banco)
CREATE TABLE IF NOT EXISTS public.regras_negocio_meta (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  modulo TEXT NOT NULL CHECK (modulo IN (
    'volumetria','faturamento','clientes','precos','repasses','exames','medicos','escalas','sistema','seguranca'
  )),
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS e políticas seguras
ALTER TABLE public.regras_negocio_meta ENABLE ROW LEVEL SECURITY;

-- Seleção pública (apenas leitura)
DROP POLICY IF EXISTS "Regras de negócio visíveis para todos" ON public.regras_negocio_meta;
CREATE POLICY "Regras de negócio visíveis para todos"
ON public.regras_negocio_meta
FOR SELECT
USING (true);

-- Escrita apenas por administradores
DROP POLICY IF EXISTS "Apenas admins podem inserir regras" ON public.regras_negocio_meta;
CREATE POLICY "Apenas admins podem inserir regras"
ON public.regras_negocio_meta
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Apenas admins podem atualizar regras" ON public.regras_negocio_meta;
CREATE POLICY "Apenas admins podem atualizar regras"
ON public.regras_negocio_meta
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Apenas admins podem excluir regras" ON public.regras_negocio_meta;
CREATE POLICY "Apenas admins podem excluir regras"
ON public.regras_negocio_meta
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_regras_negocio_meta_updated_at ON public.regras_negocio_meta;
CREATE TRIGGER trg_regras_negocio_meta_updated_at
BEFORE UPDATE ON public.regras_negocio_meta
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Upsert das regras f005 e f006 para o grupo Volumetria
INSERT INTO public.regras_negocio_meta (id, nome, modulo, categoria, ativo)
VALUES
  ('f005', 'Tipificação de Faturamento - Clientes NC Originais', 'volumetria', 'dados', TRUE),
  ('f006', 'Tipificação de Faturamento - Clientes NC Adicionais', 'volumetria', 'dados', TRUE)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  modulo = EXCLUDED.modulo,
  categoria = EXCLUDED.categoria,
  ativo = TRUE,
  updated_at = now();

-- Auditoria
SELECT public.log_audit_event('regras_negocio_meta', 'UPSERT', 'f005_f006', NULL, jsonb_build_object('ids', array['f005','f006']));