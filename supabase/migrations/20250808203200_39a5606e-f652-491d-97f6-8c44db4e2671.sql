-- Atualiza a função de limpeza de nome de cliente para incluir CEDI-* -> CEDIDIAG
CREATE OR REPLACE FUNCTION public.limpar_nome_cliente(nome_cliente text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  nome_limpo text;
BEGIN
  -- Inicializar com o nome original
  nome_limpo := nome_cliente;
  
  -- Aplicar mapeamentos específicos primeiro
  CASE nome_limpo
    WHEN 'INTERCOR2' THEN nome_limpo := 'INTERCOR';
    WHEN 'P-HADVENTISTA' THEN nome_limpo := 'HADVENTISTA';
    WHEN 'P-UNIMED_CARUARU' THEN nome_limpo := 'UNIMED_CARUARU';
    WHEN 'PRN - MEDIMAGEM CAMBORIU' THEN nome_limpo := 'MEDIMAGEM_CAMBORIU';
    WHEN 'UNIMAGEM_CENTRO' THEN nome_limpo := 'UNIMAGEM_ATIBAIA';
    WHEN 'VIVERCLIN 2' THEN nome_limpo := 'VIVERCLIN';
    -- Novos mapeamentos solicitados: unificar CEDI-* como CEDIDIAG
    WHEN 'CEDI-RJ' THEN nome_limpo := 'CEDIDIAG';
    WHEN 'CEDI-RO' THEN nome_limpo := 'CEDIDIAG';
    WHEN 'CEDI-UNIMED' THEN nome_limpo := 'CEDIDIAG';
    -- Variantes com underscore para robustez
    WHEN 'CEDI_RJ' THEN nome_limpo := 'CEDIDIAG';
    WHEN 'CEDI_RO' THEN nome_limpo := 'CEDIDIAG';
    WHEN 'CEDI_UNIMED' THEN nome_limpo := 'CEDIDIAG';
    ELSE
      -- Aplicar regras de remoção de sufixos
      -- Remover "- TELE" do final
      IF nome_limpo LIKE '%- TELE' THEN
        nome_limpo := SUBSTRING(nome_limpo FROM 1 FOR LENGTH(nome_limpo) - 6);
      END IF;
      
      -- Remover "-CT" do final
      IF nome_limpo LIKE '%-CT' THEN
        nome_limpo := SUBSTRING(nome_limpo FROM 1 FOR LENGTH(nome_limpo) - 3);
      END IF;
      
      -- Remover "-MR" do final
      IF nome_limpo LIKE '%-MR' THEN
        nome_limpo := SUBSTRING(nome_limpo FROM 1 FOR LENGTH(nome_limpo) - 3);
      END IF;
      
      -- Remover "_PLANTÃO" do final
      IF nome_limpo LIKE '%_PLANTÃO' THEN
        nome_limpo := SUBSTRING(nome_limpo FROM 1 FOR LENGTH(nome_limpo) - 8);
      END IF;
      
      -- Remover "_RMX" do final
      IF nome_limpo LIKE '%_RMX' THEN
        nome_limpo := SUBSTRING(nome_limpo FROM 1 FOR LENGTH(nome_limpo) - 4);
      END IF;
  END CASE;
  
  -- Remover espaços extras
  nome_limpo := TRIM(nome_limpo);
  
  RETURN nome_limpo;
END;
$function$;

-- Função para normalizar clientes já inseridos na volumetria
CREATE OR REPLACE FUNCTION public.normalizar_clientes_cedi()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  atualizados integer := 0;
  resultado jsonb;
BEGIN
  UPDATE volumetria_mobilemed vm
  SET "EMPRESA" = 'CEDIDIAG',
      updated_at = now()
  WHERE vm."EMPRESA" IN ('CEDI-RJ','CEDI-RO','CEDI-UNIMED','CEDI_RJ','CEDI_RO','CEDI_UNIMED');
  GET DIAGNOSTICS atualizados = ROW_COUNT;

  -- Log da operação
  PERFORM public.log_audit_event('volumetria_mobilemed', 'UPDATE', 'normalizar_clientes_cedi', NULL, jsonb_build_object('registros_atualizados', atualizados, 'novo_nome', 'CEDIDIAG'));

  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', atualizados,
    'novo_nome', 'CEDIDIAG',
    'data_processamento', now()
  );

  RETURN resultado;
END;
$$;