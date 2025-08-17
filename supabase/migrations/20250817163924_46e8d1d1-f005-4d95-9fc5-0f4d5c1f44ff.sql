-- GARANTIR que o trigger principal de processamento está ativo
-- Primeiro, remover trigger se existir
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

-- Criar o trigger principal que aplica todas as regras automaticamente
CREATE TRIGGER trigger_volumetria_processamento
    BEFORE INSERT ON volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION trigger_volumetria_processamento();

-- Verificar se as funções individuais também têm triggers
DROP TRIGGER IF EXISTS trigger_limpar_nome_cliente ON volumetria_mobilemed;
CREATE TRIGGER trigger_limpar_nome_cliente
    BEFORE INSERT OR UPDATE ON volumetria_mobilemed
    FOR EACH ROW
    EXECUTE FUNCTION trigger_limpar_nome_cliente();

-- Trigger para normalizar médico
DROP TRIGGER IF EXISTS trigger_normalizar_medico ON volumetria_mobilemed;
CREATE TRIGGER trigger_normalizar_medico
    BEFORE INSERT OR UPDATE ON volumetria_mobilemed  
    FOR EACH ROW
    EXECUTE FUNCTION trigger_normalizar_medico();