-- Função para criar contratos automaticamente para clientes que não possuem
CREATE OR REPLACE FUNCTION public.criar_contratos_clientes_automatico()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      valor_mensal,
      status,
      modalidades,
      especialidades,
      tem_precos_configurados,
      tem_parametros_configurados,
      created_by
    ) VALUES (
      cliente_record.id,
      'CONT-' || cliente_record.id || '-' || EXTRACT(YEAR FROM CURRENT_DATE),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 year',
      0, -- Valor será atualizado quando preços forem configurados
      'ativo',
      '{}', -- Array vazio, será preenchido quando preços forem configurados
      '{}', -- Array vazio, será preenchido quando preços forem configurados
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
$$;