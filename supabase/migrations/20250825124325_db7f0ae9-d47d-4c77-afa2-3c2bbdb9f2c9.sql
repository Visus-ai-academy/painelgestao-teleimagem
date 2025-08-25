-- CORREÇÃO: ATIVAR PROCESSAMENTO AUTOMÁTICO VIA TRIGGER
-- A função trigger_aplicar_regras_completas() existe mas não está sendo usada por nenhum trigger

-- Criar trigger para processamento automático de todas as regras
CREATE TRIGGER trigger_processamento_automatico_volumetria
  BEFORE INSERT OR UPDATE ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION trigger_aplicar_regras_completas();

-- Log da correção
INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
VALUES ('sistema_triggers', 'CREATE', 'trigger_processamento_automatico_volumetria', 
        jsonb_build_object(
          'acao', 'Ativação do processamento automático via trigger',
          'trigger_criado', 'trigger_processamento_automatico_volumetria',
          'funcao_chamada', 'trigger_aplicar_regras_completas()',
          'regras_incluidas', ARRAY[
            '1. Normalização nome do cliente',
            '2. Correção de modalidades (CR/DX→RX/MG, OT→DO)',
            '3. De-Para para valores zerados',
            '4. Aplicação de categorias do cadastro de exames',
            '5. Categoria especial para arquivo onco',
            '6. Definição de tipo de faturamento',
            '7. Normalização de médico',
            '8. Lógica de quebra automática'
          ],
          'timing', 'BEFORE INSERT OR UPDATE',
          'resultado', 'Processamento automático ativado - sem necessidade de edge functions manuais'
        ),
        'system', 'critical');