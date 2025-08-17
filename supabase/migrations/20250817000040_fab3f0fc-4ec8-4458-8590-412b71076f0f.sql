-- 5. ATUALIZAR O TRIGGER PRINCIPAL PARA INCLUIR TODAS AS REGRAS
DROP TRIGGER IF EXISTS trigger_volumetria_processamento ON volumetria_mobilemed;

CREATE OR REPLACE FUNCTION public.volumetria_processamento_completo()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- 1. Aplicar regras de exclusão dinâmicas PRIMEIRO (pode rejeitar o registro)
  NEW := aplicar_regras_exclusao_dinamicas(NEW);
  IF NEW IS NULL THEN
    RETURN NULL; -- Registro rejeitado pelas regras de exclusão
  END IF;
  
  -- 2. Aplicar regras de exclusão por período (v002, v003, v031)
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    NEW := aplicar_regras_retroativas(NEW);
    IF NEW IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  ELSE
    NEW := aplicar_regras_periodo_atual(NEW);
    IF NEW IS NULL THEN
      RETURN NULL; -- Registro rejeitado pelas regras
    END IF;
  END IF;
  
  -- 3. Normalizar nome do cliente
  NEW := normalizar_cliente_trigger(NEW);
  
  -- 4. Aplicar correções de modalidade (v030, v031)
  NEW := aplicar_correcao_modalidades(NEW);
  
  -- 5. Aplicar especialidades automáticas
  NEW := aplicar_especialidade_automatica(NEW);
  
  -- 6. Aplicar categorias
  NEW := aplicar_categorias_trigger(NEW);
  
  -- 7. Aplicar De-Para de prioridades
  NEW := aplicar_prioridades_de_para(NEW);
  
  -- 8. Aplicar De-Para de valores (geral)
  NEW := aplicar_de_para_trigger(NEW);
  
  -- 9. Aplicar valores específicos para onco
  NEW := aplicar_valor_onco(NEW);
  
  -- 10. Aplicar tipificação de faturamento
  NEW := aplicar_tipificacao_faturamento(NEW);
  
  -- 11. Aplicar quebra de exames (ÚLTIMO - pode gerar registros adicionais)
  NEW := aplicar_quebra_exames(NEW);
  
  -- Retornar o registro processado
  RETURN NEW;
END;
$function$;

-- 6. CRIAR O TRIGGER ATUALIZADO
CREATE TRIGGER trigger_volumetria_processamento
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION volumetria_processamento_completo();

-- 7. FUNÇÃO PARA OBTER ESTATÍSTICAS DAS REGRAS APLICADAS
CREATE OR REPLACE FUNCTION public.get_regras_aplicadas_detalhadas()
RETURNS TABLE(
  regra text, 
  total_aplicacoes bigint, 
  ultima_aplicacao timestamp with time zone,
  registros_rejeitados bigint,
  registros_processados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    'Regras de Exclusão Dinâmicas' as regra,
    COUNT(*) as total_aplicacoes,
    MAX(al.timestamp) as ultima_aplicacao,
    COUNT(*) FILTER (WHERE al.operation LIKE 'REGRA_%REJEITADO') as registros_rejeitados,
    COUNT(*) FILTER (WHERE al.operation LIKE 'REGRA_%PROCESSADO') as registros_processados
  FROM audit_logs al 
  WHERE al.table_name = 'volumetria_mobilemed'
    AND al.operation LIKE 'REGRA_%'
  
  UNION ALL
  
  SELECT 
    operation as regra,
    COUNT(*) as total_aplicacoes,
    MAX(timestamp) as ultima_aplicacao,
    0::bigint as registros_rejeitados,
    COUNT(*) as registros_processados
  FROM audit_logs 
  WHERE table_name = 'volumetria_mobilemed'
    AND operation IN ('QUEBRA_EXAMES', 'VALOR_ONCO', 'ESPECIALIDADE_AUTO')
  GROUP BY operation
  ORDER BY total_aplicacoes DESC;
END;
$function$;

-- 8. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON FUNCTION public.aplicar_quebra_exames() IS 'v027: Aplica regras de quebra de exames compostos em individuais';
COMMENT ON FUNCTION public.aplicar_regras_exclusao_dinamicas() IS 'Aplica regras de exclusão configuradas dinamicamente na tabela regras_exclusao_faturamento';
COMMENT ON FUNCTION public.aplicar_valor_onco() IS 'Busca valores específicos para exames de oncologia';
COMMENT ON FUNCTION public.aplicar_especialidade_automatica() IS 'Define especialidade baseada no cadastro de exames ou modalidade';
COMMENT ON FUNCTION public.volumetria_processamento_completo() IS 'Trigger principal que aplica TODAS as regras de negócio na volumetria';