-- Criar trigger que ativa a aplicação automática de regras
CREATE TRIGGER trigger_aplicar_regras_pos_upload
    AFTER UPDATE ON processamento_uploads
    FOR EACH ROW
    EXECUTE FUNCTION aplicar_regras_automatico();