-- Criar a tabela de regras de exclusão se não existir
CREATE TABLE IF NOT EXISTS regras_exclusao_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_regra text NOT NULL,
  motivo_exclusao text NOT NULL,
  criterios jsonb NOT NULL,
  ativo boolean DEFAULT true,
  prioridade integer DEFAULT 1,
  aplicar_incremental boolean DEFAULT true,
  aplicar_legado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Inserir regras de teste
INSERT INTO regras_exclusao_faturamento (
  nome_regra,
  motivo_exclusao,
  criterios,
  ativo,
  prioridade,
  aplicar_incremental,
  aplicar_legado
) VALUES 
(
  'TESTE_EXCLUSAO_EMPRESA',
  'Empresa de teste para validação do sistema',
  '{"empresa": "TESTE_EXCLUSAO_EMPRESA"}',
  true,
  1,
  true,
  true
),
(
  'TESTE_EXCLUSAO_VALOR_ZERO',
  'Registros com valor zero devem ser excluídos',
  '{"valor": {"=": 0}}',
  true,
  2,
  true,
  true
);

-- Configurar trigger na tabela volumetria_mobilemed
CREATE TRIGGER trigger_aplicar_exclusoes_dinamicas
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_regras_exclusao_dinamicas();