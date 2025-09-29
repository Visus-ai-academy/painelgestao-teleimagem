-- Tornar CRM opcional conforme regra de negócio (apenas nome é obrigatório)
ALTER TABLE public.medicos
ALTER COLUMN crm DROP NOT NULL;

-- Manter consistência: nenhuma alteração em índices/uniqueness necessária,
-- pois UNIQUE em Postgres permite múltiplos NULLs.
