-- Habilitar RLS e criar políticas para as novas tabelas de faturamento

-- 1. Habilitar RLS nas tabelas criadas
ALTER TABLE precos_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_faturamento ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para precos_servicos
CREATE POLICY "Admins podem gerenciar todos os preços" 
ON precos_servicos 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver todos os preços" 
ON precos_servicos 
FOR SELECT 
USING (is_manager_or_admin());

-- 3. Políticas para parametros_faturamento  
CREATE POLICY "Admins podem gerenciar todos os parâmetros" 
ON parametros_faturamento 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver todos os parâmetros" 
ON parametros_faturamento 
FOR SELECT 
USING (is_manager_or_admin());

-- 4. Criar triggers para as novas tabelas
CREATE TRIGGER trigger_precos_servicos_atualizar_contrato
  AFTER INSERT OR UPDATE OR DELETE ON precos_servicos
  FOR EACH ROW EXECUTE FUNCTION atualizar_status_configuracao_contrato();

CREATE TRIGGER trigger_parametros_faturamento_atualizar_contrato
  AFTER INSERT OR UPDATE OR DELETE ON parametros_faturamento
  FOR EACH ROW EXECUTE FUNCTION atualizar_status_configuracao_contrato();

-- 5. Trigger para updated_at
CREATE TRIGGER update_precos_servicos_updated_at
  BEFORE UPDATE ON precos_servicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parametros_faturamento_updated_at
  BEFORE UPDATE ON parametros_faturamento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();