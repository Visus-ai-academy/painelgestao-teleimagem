-- Corrigir a função aplicar_de_para_automatico para usar comparação case-insensitive
CREATE OR REPLACE FUNCTION public.aplicar_de_para_automatico(arquivo_fonte_param text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_processados INTEGER := 0;
  total_atualizados INTEGER := 0;
  registro RECORD;
  valor_referencia NUMERIC;
BEGIN
  -- Processar registros com valores zerados
  FOR registro IN 
    SELECT vm.*
    FROM volumetria_mobilemed vm
    WHERE (arquivo_fonte_param IS NULL OR vm.arquivo_fonte = arquivo_fonte_param)
    AND COALESCE(vm."VALORES", 0) = 0
  LOOP
    -- Buscar valor no De-Para usando comparação case-insensitive
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE UPPER(TRIM(vr.estudo_descricao)) = UPPER(TRIM(registro."ESTUDO_DESCRICAO"))
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      UPDATE volumetria_mobilemed 
      SET "VALORES" = valor_referencia,
          updated_at = now()
      WHERE id = registro.id;
      
      total_atualizados := total_atualizados + 1;
    END IF;
    
    total_processados := total_processados + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'sucesso', true,
    'total_processados', total_processados,
    'total_atualizados', total_atualizados,
    'arquivo_fonte', COALESCE(arquivo_fonte_param, 'TODOS')
  );
END;
$function$;