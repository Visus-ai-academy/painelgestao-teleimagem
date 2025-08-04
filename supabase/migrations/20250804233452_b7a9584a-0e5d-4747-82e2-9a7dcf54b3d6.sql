-- Primeiro, vamos verificar quantos CNPJs únicos temos
SELECT COUNT(DISTINCT cnpj) as cnpjs_unicos, COUNT(*) as total_clientes 
FROM clientes 
WHERE ativo = true AND cnpj IS NOT NULL AND cnpj != '';

-- Verificar se há CNPJs duplicados
SELECT cnpj, COUNT(*) as quantidade, string_agg(nome, ', ') as clientes
FROM clientes 
WHERE ativo = true AND cnpj IS NOT NULL AND cnpj != ''
GROUP BY cnpj
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- Criar função corrigida para contratos por CNPJ único
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
  -- Buscar CNPJs únicos que não possuem contrato
  -- Usar o primeiro cliente encontrado para cada CNPJ como representante
  FOR cliente_record IN
    WITH cnpjs_unicos AS (
      SELECT DISTINCT ON (cnpj) 
        c.id, c.nome, c.cnpj, c.endereco, c.telefone, c.email, c.contato
      FROM clientes c
      WHERE c.ativo = true 
        AND c.cnpj IS NOT NULL 
        AND c.cnpj != ''
      ORDER BY c.cnpj, c.created_at ASC
    )
    SELECT cu.*
    FROM cnpjs_unicos cu
    LEFT JOIN contratos_clientes cc ON cc.cliente_id = cu.id
    WHERE cc.id IS NULL
  LOOP
    -- Criar contrato para o CNPJ
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
      observacoes_contratuais,
      created_by
    ) VALUES (
      cliente_record.id,
      'CONT-' || SUBSTRING(cliente_record.cnpj FROM 1 FOR 8) || '-' || EXTRACT(YEAR FROM CURRENT_DATE),
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
      'Contrato por CNPJ único - Cliente principal: ' || cliente_record.nome,
      auth.uid()
    );
    
    contratos_criados := contratos_criados + 1;
    
    -- Log da criação
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
    VALUES ('contratos_clientes', 'INSERT', cliente_record.id::text, 
            jsonb_build_object(
              'cliente_nome', cliente_record.nome, 
              'cnpj', cliente_record.cnpj,
              'numero_contrato', 'CONT-' || SUBSTRING(cliente_record.cnpj FROM 1 FOR 8) || '-' || EXTRACT(YEAR FROM CURRENT_DATE)
            ),
            COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  END LOOP;
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'contratos_criados', contratos_criados,
    'observacao', 'Contratos criados por CNPJ único',
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$function$;