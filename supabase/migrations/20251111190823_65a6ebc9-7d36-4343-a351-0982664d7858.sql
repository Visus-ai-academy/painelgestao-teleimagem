-- Fix trigger function that references non-existent column valor_urgencia on precos_servicos
-- This was causing all inserts to fail with: record "new" has no field "valor_urgencia"

-- Replace the function to only round existing columns
CREATE OR REPLACE FUNCTION public.round_precos_servicos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Round valor_base to 2 decimals when present
  IF NEW.valor_base IS NOT NULL THEN
    NEW.valor_base := ROUND(NEW.valor_base::numeric, 2);
  END IF;
  
  -- Do not reference valor_urgencia since the column does not exist in precos_servicos
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and uses this function (idempotent recreation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_round_precos_servicos' 
      AND tgrelid = 'public.precos_servicos'::regclass
  ) THEN
    CREATE TRIGGER trg_round_precos_servicos
    BEFORE INSERT OR UPDATE ON public.precos_servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.round_precos_servicos();
  END IF;
END $$;

-- Touch the function atualizar_status_configuracao_contrato to ensure it stays attached (no change)
-- This is a no-op to avoid altering existing behavior
