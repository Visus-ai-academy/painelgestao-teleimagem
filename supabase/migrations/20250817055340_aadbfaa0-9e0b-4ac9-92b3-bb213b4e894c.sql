-- Corrigir função removendo referência à coluna inexistente lote_upload
CREATE OR REPLACE FUNCTION public.aplicar_validacao_cliente_volumetria(lote_upload_param text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_sem_cliente INTEGER := 0;
  total_clientes_nao_encontrados INTEGER := 0;
  clientes_nao_encontrados TEXT[] := '{}';
  nome_cliente_extraido TEXT;
  nome_cliente_limpo TEXT;
  cliente_id_encontrado UUID;
  preco_record RECORD;
  resultado jsonb;
BEGIN
  -- Log início da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('precos_servicos', 'UPDATE', 'inicio', 
          jsonb_build_object('lote_upload', lote_upload_param, 'timestamp', now()),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  -- Buscar preços sem cliente_id que tenham informação do cliente original na descrição
  -- REMOVIDA A REFERÊNCIA À COLUNA lote_upload QUE NÃO EXISTE
  FOR preco_record IN 
    SELECT id, descricao 
    FROM precos_servicos 
    WHERE cliente_id IS NULL 
      AND descricao IS NOT NULL 
      AND descricao LIKE 'Cliente original:%'
  LOOP
    -- Extrair nome do cliente da descrição "Cliente original: NOME_CLIENTE"
    nome_cliente_extraido := TRIM(SUBSTRING(preco_record.descricao FROM 'Cliente original:\s*(.+)'));
    
    -- Limpar caracteres invisíveis, espaços extras e caracteres nulos
    nome_cliente_limpo := TRIM(REGEXP_REPLACE(nome_cliente_extraido, '[[:space:]]+', ' ', 'g'));
    nome_cliente_limpo := TRIM(REGEXP_REPLACE(nome_cliente_limpo, E'[\\x00-\\x1F\\x7F]', '', 'g'));
    
    IF nome_cliente_limpo IS NOT NULL AND nome_cliente_limpo != '' THEN
      -- Buscar cliente EXCLUSIVAMENTE pela coluna nome_fantasia (LIMPA)
      SELECT id INTO cliente_id_encontrado
      FROM clientes 
      WHERE TRIM(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(nome_fantasia, ''), '[[:space:]]+', ' ', 'g'), E'[\\x00-\\x1F\\x7F]', '', 'g')) = nome_cliente_limpo
        AND ativo = true
      LIMIT 1;
      
      -- Se não encontrou por nome_fantasia, fazer log específico
      IF cliente_id_encontrado IS NULL THEN
        RAISE NOTICE 'Cliente não encontrado por nome_fantasia: "%" (limpo)', nome_cliente_limpo;
        
        -- Tentar buscar por nome também para debug
        SELECT nome_fantasia INTO nome_cliente_extraido
        FROM clientes 
        WHERE TRIM(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(nome_fantasia, ''), '[[:space:]]+', ' ', 'g'), E'[\\x00-\\x1F\\x7F]', '', 'g')) ILIKE '%' || nome_cliente_limpo || '%'
          AND ativo = true
        LIMIT 1;
        
        IF nome_cliente_extraido IS NOT NULL THEN
          RAISE NOTICE 'Possível match encontrado: "%"', nome_cliente_extraido;
        END IF;
      END IF;
      
      IF cliente_id_encontrado IS NOT NULL THEN
        -- Atualizar preço com o cliente_id encontrado
        UPDATE precos_servicos 
        SET cliente_id = cliente_id_encontrado,
            updated_at = now()
        WHERE id = preco_record.id;
        
        registros_atualizados := registros_atualizados + 1;
        RAISE NOTICE 'Cliente associado: "%" -> ID %', nome_cliente_limpo, cliente_id_encontrado;
      ELSE
        -- Cliente não encontrado, adicionar à lista
        registros_sem_cliente := registros_sem_cliente + 1;
        total_clientes_nao_encontrados := total_clientes_nao_encontrados + 1;
        
        -- Adicionar à lista se ainda não estiver presente
        IF NOT (nome_cliente_limpo = ANY(clientes_nao_encontrados)) THEN
          clientes_nao_encontrados := array_append(clientes_nao_encontrados, nome_cliente_limpo);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Construir resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'registros_sem_cliente', registros_sem_cliente,
    'total_clientes_nao_encontrados', total_clientes_nao_encontrados,
    'clientes_nao_encontrados', clientes_nao_encontrados,
    'data_processamento', now(),
    'criterio_busca', 'nome_fantasia exclusivamente (corrigido - sem lote_upload)'
  );

  -- Log do resultado
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('precos_servicos', 'UPDATE', 'resultado', resultado,
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');

  RETURN resultado;
END;
$function$;