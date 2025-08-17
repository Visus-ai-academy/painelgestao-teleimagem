-- Criar função para validar e enriquecer dados de volumetria com informações do cliente
CREATE OR REPLACE FUNCTION public.aplicar_validacao_cliente_volumetria(
  lote_upload_param TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_sem_cliente INTEGER := 0;
  clientes_nao_encontrados TEXT[] := ARRAY[]::TEXT[];
  registro_volumetria RECORD;
  cliente_info RECORD;
  tipo_faturamento_final TEXT;
BEGIN
  -- Log início do processamento
  RAISE NOTICE 'Iniciando validação de clientes para lote: %', COALESCE(lote_upload_param, 'TODOS');
  
  -- Cursor para percorrer registros de volumetria
  FOR registro_volumetria IN 
    SELECT vm.id, vm."EMPRESA", vm."CATEGORIA", vm."PRIORIDADE", vm."MODALIDADE"
    FROM volumetria_mobilemed vm
    WHERE (lote_upload_param IS NULL OR vm.lote_upload = lote_upload_param)
      AND vm."EMPRESA" IS NOT NULL
  LOOP
    -- Buscar cliente correspondente
    SELECT 
      c.id,
      c.nome_fantasia,
      c.tipo_cliente,
      cc.tipo_cliente as tipo_cliente_contrato
    INTO cliente_info
    FROM clientes c
    LEFT JOIN contratos_clientes cc ON cc.cliente_id = c.id AND cc.status = 'ativo'
    WHERE c.nome_mobilemed = registro_volumetria."EMPRESA"
       OR c.nome = registro_volumetria."EMPRESA"
       OR c.nome_fantasia = registro_volumetria."EMPRESA"
    LIMIT 1;
    
    IF cliente_info.id IS NOT NULL THEN
      -- Cliente encontrado - determinar tipo de faturamento
      
      -- Determinar tipo base (CO ou NC)
      IF COALESCE(cliente_info.tipo_cliente_contrato, cliente_info.tipo_cliente, 'CO') = 'CO' THEN
        -- Cliente COM faturamento
        IF registro_volumetria."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
          tipo_faturamento_final := 'CO-FT'; -- Faturamento especial para oncologia
        ELSIF registro_volumetria."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
          tipo_faturamento_final := 'CO-FT'; -- Urgência sempre faturada
        ELSIF registro_volumetria."MODALIDADE" IN ('CT', 'MR') THEN
          tipo_faturamento_final := 'CO-FT'; -- Alta complexidade sempre faturada
        ELSE
          tipo_faturamento_final := 'CO-FT'; -- Faturamento padrão
        END IF;
      ELSE
        -- Cliente SEM faturamento (NC)
        IF registro_volumetria."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
          tipo_faturamento_final := 'NC-NF'; -- Oncologia sem faturamento
        ELSIF registro_volumetria."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') OR 
              registro_volumetria."MODALIDADE" IN ('CT', 'MR') THEN
          tipo_faturamento_final := 'NC-FT'; -- Urgência/Alta complexidade com faturamento diferenciado
        ELSE
          tipo_faturamento_final := 'NC-NF'; -- Sem faturamento
        END IF;
      END IF;
      
      -- Atualizar registro com informações do cliente
      UPDATE volumetria_mobilemed 
      SET 
        cliente_nome_fantasia = cliente_info.nome_fantasia,
        tipo_cliente = COALESCE(cliente_info.tipo_cliente_contrato, cliente_info.tipo_cliente, 'CO'),
        tipo_faturamento = tipo_faturamento_final,
        updated_at = now()
      WHERE id = registro_volumetria.id;
      
      registros_atualizados := registros_atualizados + 1;
      
    ELSE
      -- Cliente não encontrado
      registros_sem_cliente := registros_sem_cliente + 1;
      clientes_nao_encontrados := array_append(clientes_nao_encontrados, registro_volumetria."EMPRESA");
      
      -- Marcar como cliente não encontrado mas definir tipo padrão
      UPDATE volumetria_mobilemed 
      SET 
        cliente_nome_fantasia = NULL,
        tipo_cliente = 'CO', -- Padrão
        tipo_faturamento = 'CO-FT', -- Padrão para faturamento
        updated_at = now()
      WHERE id = registro_volumetria.id;
    END IF;
    
  END LOOP;
  
  -- Remover duplicatas do array de clientes não encontrados
  SELECT array_agg(DISTINCT unnest) INTO clientes_nao_encontrados 
  FROM unnest(clientes_nao_encontrados);
  
  -- Log do resultado
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'VALIDACAO_CLIENTE', 
          COALESCE(lote_upload_param, 'TODOS'),
          jsonb_build_object(
            'registros_atualizados', registros_atualizados,
            'registros_sem_cliente', registros_sem_cliente,
            'clientes_nao_encontrados', clientes_nao_encontrados
          ),
          'system', 'info');
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'registros_sem_cliente', registros_sem_cliente,
    'total_clientes_nao_encontrados', array_length(clientes_nao_encontrados, 1),
    'clientes_nao_encontrados', clientes_nao_encontrados,
    'data_processamento', now()
  );
END;
$$;