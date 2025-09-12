-- 1. Corrigir registros existentes do Dr. Rodrigo Vaz de Lima para clientes F007
UPDATE volumetria_mobilemed 
SET tipo_faturamento = 'NC-NF',
    updated_at = now()
WHERE "EMPRESA" IN ('CBU', 'CEDI_RJ', 'CEDI_RO', 'CEDI_UNIMED', 'RADMED')
  AND "ESPECIALIDADE" = 'MEDICINA INTERNA' 
  AND "MEDICO" = 'Dr. Rodrigo Vaz de Lima';

-- 2. Criar função para aplicar regra F007 específica
CREATE OR REPLACE FUNCTION aplicar_regra_f007_medicina_interna()
RETURNS TRIGGER AS $$
BEGIN
  -- Aplicar regra F007: Clientes especiais + Medicina Interna + Dr. Rodrigo Vaz de Lima = NC-NF
  IF NEW."EMPRESA" IN ('CBU', 'CEDI_RJ', 'CEDI_RO', 'CEDI_UNIMED', 'RADMED') 
     AND NEW."ESPECIALIDADE" = 'MEDICINA INTERNA' 
     AND NEW."MEDICO" = 'Dr. Rodrigo Vaz de Lima' THEN
    NEW.tipo_faturamento := 'NC-NF';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para aplicar automaticamente a regra F007
DROP TRIGGER IF EXISTS trigger_aplicar_regra_f007 ON volumetria_mobilemed;
CREATE TRIGGER trigger_aplicar_regra_f007
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regra_f007_medicina_interna();