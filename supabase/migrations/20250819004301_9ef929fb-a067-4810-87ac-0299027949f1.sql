-- Corrigir apenas triggers problemáticos (sem índices CONCURRENTLY)

-- 1. Corrigir o trigger principal da tabela volumetria_mobilemed
CREATE OR REPLACE FUNCTION public.handle_volumetria_mobilemed_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Para DELETE, usar OLD
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            old_data,
            timestamp
        ) VALUES (
            'volumetria_mobilemed',
            'DELETE',
            OLD.id::text,
            row_to_json(OLD),
            NOW()
        );
        RETURN OLD;
    END IF;
    
    -- Para INSERT e UPDATE, usar NEW
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            new_data,
            timestamp
        ) VALUES (
            'volumetria_mobilemed',
            'INSERT',
            NEW.id::text,
            row_to_json(NEW),
            NOW()
        );
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            old_data,
            new_data,
            timestamp
        ) VALUES (
            'volumetria_mobilemed',
            'UPDATE',
            NEW.id::text,
            row_to_json(OLD),
            row_to_json(NEW),
            NOW()
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger
DROP TRIGGER IF EXISTS tr_volumetria_mobilemed_audit ON public.volumetria_mobilemed;
CREATE TRIGGER tr_volumetria_mobilemed_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.volumetria_mobilemed
    FOR EACH ROW EXECUTE FUNCTION handle_volumetria_mobilemed_changes();

-- 2. Corrigir função de atualização de timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger de timestamp
DROP TRIGGER IF EXISTS tr_volumetria_mobilemed_updated_at ON public.volumetria_mobilemed;
CREATE TRIGGER tr_volumetria_mobilemed_updated_at
    BEFORE UPDATE ON public.volumetria_mobilemed
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Corrigir função v002
CREATE OR REPLACE FUNCTION public.apply_business_rules_v002()
RETURNS TRIGGER AS $$
BEGIN
    -- Aplicar regra v002: substituir MODALIDADE 'OT' por 'US' se ESPECIALIDADE = 'USG'
    IF NEW."MODALIDADE" = 'OT' AND NEW."ESPECIALIDADE" = 'USG' THEN
        NEW."MODALIDADE" = 'US';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger v002
DROP TRIGGER IF EXISTS tr_apply_business_rules_v002 ON public.volumetria_mobilemed;
CREATE TRIGGER tr_apply_business_rules_v002
    BEFORE INSERT OR UPDATE ON public.volumetria_mobilemed
    FOR EACH ROW EXECUTE FUNCTION apply_business_rules_v002();

-- 4. Corrigir função v003
CREATE OR REPLACE FUNCTION public.apply_business_rules_v003()
RETURNS TRIGGER AS $$
BEGIN
    -- Aplicar regra v003: substituir MODALIDADE 'OT' por 'RX' se ESPECIALIDADE = 'RX'
    IF NEW."MODALIDADE" = 'OT' AND NEW."ESPECIALIDADE" = 'RX' THEN
        NEW."MODALIDADE" = 'RX';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger v003
DROP TRIGGER IF EXISTS tr_apply_business_rules_v003 ON public.volumetria_mobilemed;
CREATE TRIGGER tr_apply_business_rules_v003
    BEFORE INSERT OR UPDATE ON public.volumetria_mobilemed
    FOR EACH ROW EXECUTE FUNCTION apply_business_rules_v003();

-- Log da correção
INSERT INTO audit_logs (
    table_name,
    operation,
    record_id,
    new_data,
    user_email,
    severity
) VALUES (
    'system_maintenance',
    'TRIGGER_FIX',
    'trigger_optimization',
    '{"action": "Fixed volumetria_mobilemed triggers to resolve relation NEW does not exist error", "triggers_corrected": ["audit", "timestamp", "v002", "v003"]}',
    'system', 
    'info'
);