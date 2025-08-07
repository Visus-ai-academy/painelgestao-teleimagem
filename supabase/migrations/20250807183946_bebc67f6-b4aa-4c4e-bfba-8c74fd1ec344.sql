-- Criar função para limpar nomes de clientes segundo regras específicas
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
$function$