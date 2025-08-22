-- Inserir regras de teste usando a estrutura correta da tabela
INSERT INTO regras_exclusao_faturamento (
  nome,
  descricao,
  criterios,
  ativo,
  prioridade,
  aplicar_incremental,
  aplicar_legado,
  tipo_regra
) VALUES 
(
  'TESTE_EXCLUSAO_EMPRESA',
  'Empresa de teste para validação do sistema',
  '{"empresa": "TESTE_EXCLUSAO_EMPRESA"}',
  true,
  1,
  true,
  true,
  'exclusao_empresa'
),
(
  'TESTE_EXCLUSAO_VALOR_ZERO',
  'Registros com valor zero devem ser excluídos',
  '{"valor": {"=": 0}}',
  true,
  2,
  true,
  true,
  'exclusao_valor'
);

-- Configurar trigger na tabela volumetria_mobilemed se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_aplicar_exclusoes_dinamicas' 
      AND event_object_table = 'volumetria_mobilemed'
  ) THEN
    CREATE TRIGGER trigger_aplicar_exclusoes_dinamicas
      BEFORE INSERT ON volumetria_mobilemed
      FOR EACH ROW
      EXECUTE FUNCTION aplicar_regras_exclusao_dinamicas();
  END IF;
END $$;