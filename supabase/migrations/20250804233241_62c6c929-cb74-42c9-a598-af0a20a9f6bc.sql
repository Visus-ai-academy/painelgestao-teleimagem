-- Remover coluna valor_mensal e adicionar campos apropriados para contratos de volumetria
ALTER TABLE contratos_clientes 
DROP COLUMN IF EXISTS valor_mensal;

-- Adicionar campos para serviços contratados e configurações
ALTER TABLE contratos_clientes 
ADD COLUMN servicos_contratados JSONB DEFAULT '[]'::jsonb,
ADD COLUMN configuracoes_franquia JSONB DEFAULT '{}'::jsonb,
ADD COLUMN configuracoes_integracao JSONB DEFAULT '{}'::jsonb,
ADD COLUMN tabela_precos JSONB DEFAULT '{}'::jsonb,
ADD COLUMN observacoes_contratuais TEXT;

-- Comentários para documentar a estrutura
COMMENT ON COLUMN contratos_clientes.servicos_contratados IS 'Array de serviços contratados com modalidades, especialidades, categorias e prioridades';
COMMENT ON COLUMN contratos_clientes.configuracoes_franquia IS 'Configurações de franquia: { "tem_franquia": true, "volume_franquia": 100, "valor_franquia": 5000.00, "valor_acima_franquia": 45.00 }';
COMMENT ON COLUMN contratos_clientes.configuracoes_integracao IS 'Configurações de integração: { "cobra_integracao": true, "valor_integracao": 150.00 }';
COMMENT ON COLUMN contratos_clientes.tabela_precos IS 'Estrutura de preços por modalidade/especialidade/categoria/prioridade';

-- Atualizar função de criação automática de contratos
CREATE OR REPLACE FUNCTION public.criar_contratos_clientes_automatico()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cliente_record RECORD;
  contratos_criados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Buscar clientes ativos que não possuem contrato
  FOR cliente_record IN
    SELECT c.id, c.nome, c.cnpj
    FROM clientes c
    LEFT JOIN contratos_clientes cc ON c.id = cc.cliente_id
    WHERE c.ativo = true 
      AND cc.id IS NULL
  LOOP
    -- Criar contrato padrão para o cliente
    INSERT INTO contratos_clientes (
      cliente_id,
      numero_contrato,
      data_inicio,
      data_fim,
      status,
      modalidades,
      especialidades,
      servicos_contratados,
      configuracoes_franquia,
      configuracoes_integracao,
      tabela_precos,
      tem_precos_configurados,
      tem_parametros_configurados,
      created_by
    ) VALUES (
      cliente_record.id,
      'CONT-' || cliente_record.id || '-' || EXTRACT(YEAR FROM CURRENT_DATE),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 year',
      'ativo',
      '{}', -- Será preenchido quando preços forem configurados
      '{}', -- Será preenchido quando preços forem configurados
      '[]'::jsonb, -- Será preenchido quando preços forem configurados
      '{}'::jsonb, -- Será preenchido quando parâmetros forem configurados
      '{}'::jsonb, -- Será preenchido quando parâmetros forem configurados
      '{}'::jsonb, -- Será preenchido quando preços forem configurados
      false, -- Será atualizado automaticamente via trigger
      false, -- Será atualizado automaticamente via trigger
      auth.uid()
    );
    
    contratos_criados := contratos_criados + 1;
    
    -- Log da criação
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('contratos_clientes', 'INSERT', cliente_record.id::text, 
            jsonb_build_object('cliente_nome', cliente_record.nome, 'numero_contrato', 'CONT-' || cliente_record.id || '-' || EXTRACT(YEAR FROM CURRENT_DATE)),
            COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  END LOOP;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'contratos_criados', contratos_criados,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;