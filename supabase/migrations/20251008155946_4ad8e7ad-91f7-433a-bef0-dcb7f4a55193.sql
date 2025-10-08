-- REGRA v007 EXPANDIDA: Adicionar mapeamentos de especialidades problemáticas ao trigger
CREATE OR REPLACE FUNCTION public.aplicar_regras_completas_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nova_prioridade TEXT;
  valor_referencia NUMERIC;
  medicos_neuro TEXT[] := ARRAY[
    'AMAURI SILVA SOBRINHO', 'ANA CAROLINA OTTAIANO', 'ARTHUR DE FREITAS FERREIRA',
    'CAIO BATALHA PEREIRA', 'CARLOS ALEXANDRE MARTINELLI', 'DANIELA CARTOLANO',
    'EDUARDO WALTER RABELO ARRUDA', 'EFRAIM DA SILVA FERREIRA', 'ELTON DIAS LOPES BARUD',
    'EUGENIO CASTRO', 'FABIO SANDERSON FERNANDES', 'FERNANDA VELOSO PEREIRA',
    'FRANCISCA ROCELIA SILVA DE FREITAS', 'GIOVANNA MARTINS', 'GUSTAVO ANDREIS',
    'GUSTAVO COUTINHO FERREIRA', 'HELIANTHO DE SIQUEIRA LIMA FILHO', 'HENRIQUE BORTOT ZUPPANI',
    'JAINY SOUSA OLIVEIRA', 'JAMES HENRIQUE YARED', 'JANDER LUIZ BUCKER FILHO',
    'LARA MACATRAO DUARTE BACELAR', 'LARISSA NARA COSTA FREITAS', 'LUCIANE LUCAS LUCIO',
    'LUIS FILIPE NAGATA GASPARINI', 'LUIS TERCIO FEITOSA COELHO', 'MARCELO BANDEIRA FILHO',
    'MARCOS MARINS', 'MARCUS ROGERIO LOLA DE ANDRADE', 'MARIANA HELENA DO CARMO',
    'MARILIA ASSUNCAO JORGE', 'MARLYSON LUIZ OLIVIER DE OLIVEIRA', 'OTTO WOLF MACIEL',
    'PAULO DE TARSO MARTINS RIBEIRO', 'PERICLES MORAES PEREIRA', 'RAFAELA CONTESINI NIVOLONI',
    'RAISSA NERY DE LUNA FREIRE LEITE', 'RICARDO JORGE VITAL', 'THIAGO BEZERRA MATIAS',
    'TIAGO OLIVEIRA LORDELO', 'TOMAS ANDRADE LOURENCAO FREDDI', 'VIRGILIO DE ARAUJO OLIVEIRA',
    'YURI AARAO AMARAL SERRUYA'
  ];
  medico_normalizado TEXT;
  is_neuro BOOLEAN := false;
BEGIN
  -- Só aplicar para arquivos que NÃO são retroativos
  IF NEW.arquivo_fonte LIKE '%retroativo%' THEN
    RETURN NEW;
  END IF;
  
  -- 1. Aplicar limpeza do nome do cliente
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN
    NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA");
  END IF;
  
  -- 2. Aplicar normalização do médico
  IF NEW."MEDICO" IS NOT NULL THEN
    NEW."MEDICO" := normalizar_medico(NEW."MEDICO");
  END IF;
  
  -- 3. Aplicar correções de modalidade
  IF NEW."MODALIDADE" IN ('CR', 'DX') THEN
    IF NEW."ESTUDO_DESCRICAO" = 'MAMOGRAFIA' THEN
      NEW."MODALIDADE" := 'MG';
    ELSE
      NEW."MODALIDADE" := 'RX';
    END IF;
  END IF;
  
  IF NEW."MODALIDADE" = 'OT' THEN
    NEW."MODALIDADE" := 'DO';
  END IF;
  
  -- 4. Aplicar categorias
  IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
    SELECT ce.categoria INTO NEW."CATEGORIA"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.categoria IS NOT NULL
      AND ce.categoria != ''
    LIMIT 1;
    
    IF NEW."CATEGORIA" IS NULL OR NEW."CATEGORIA" = '' THEN
      NEW."CATEGORIA" := 'SC';
    END IF;
  END IF;
  
  -- 5. Aplicar especialidades
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
      AND ce.especialidade != ''
    LIMIT 1;
    
    IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
      NEW."ESPECIALIDADE" := 'GERAL';
    END IF;
  END IF;

  -- 5.1. REGRA v007 EXPANDIDA: Corrigir especialidades problemáticas
  CASE NEW."ESPECIALIDADE"
    WHEN 'COLUNAS' THEN
      medico_normalizado := UPPER(REGEXP_REPLACE(TRIM(COALESCE(NEW."MEDICO", '')), '^DR[A]?\s+', '', 'i'));
      SELECT EXISTS(
        SELECT 1 FROM unnest(medicos_neuro) AS medico_lista
        WHERE medico_lista = medico_normalizado
      ) INTO is_neuro;
      
      IF is_neuro THEN
        NEW."ESPECIALIDADE" := 'NEURO';
      ELSE
        NEW."ESPECIALIDADE" := 'MUSCULO ESQUELETICO';
      END IF;
      
    WHEN 'ONCO MEDICINA INTERNA' THEN
      NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
      
    WHEN 'ANGIOTCS' THEN
      NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
      
    WHEN 'CABEÇA-PESCOÇO' THEN
      NEW."ESPECIALIDADE" := 'NEURO';
      
    WHEN 'TÓRAX' THEN
      NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
      
    WHEN 'CORPO' THEN
      NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
      
    WHEN 'D.O' THEN
      NEW."ESPECIALIDADE" := 'MUSCULO ESQUELETICO';
      
    WHEN 'MAMO' THEN
      NEW."ESPECIALIDADE" := 'MAMA';
      
    WHEN 'TOMOGRAFIA' THEN
      NEW."ESPECIALIDADE" := 'MEDICINA INTERNA';
      
    WHEN 'CARDIO COM SCORE' THEN
      NEW."ESPECIALIDADE" := 'CARDIO';
      
    ELSE
      -- Manter especialidade original
      NULL;
  END CASE;

  -- 6. Aplicar De-Para de Prioridades
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  -- 7. Aplicar De-Para de Valores (para valores zerados)
  IF COALESCE(NEW."VALORES", 0) = 0 THEN
    SELECT vr.valores INTO valor_referencia
    FROM valores_referencia_de_para vr
    WHERE UPPER(TRIM(vr.estudo_descricao)) = UPPER(TRIM(NEW."ESTUDO_DESCRICAO"))
      AND vr.ativo = true
    LIMIT 1;
    
    IF valor_referencia IS NOT NULL THEN
      NEW."VALORES" := valor_referencia;
    END IF;
  END IF;
  
  -- 8. Aplicar tipificação de faturamento
  IF NEW.tipo_faturamento IS NULL OR NEW.tipo_faturamento = '' THEN
    IF NEW."CATEGORIA" IN ('onco', 'Onco', 'ONCO') THEN
      NEW.tipo_faturamento := 'oncologia';
    ELSIF NEW."PRIORIDADE" IN ('urgência', 'urgencia', 'URGENCIA') THEN
      NEW.tipo_faturamento := 'urgencia';
    ELSIF NEW."MODALIDADE" IN ('CT', 'MR') THEN
      NEW.tipo_faturamento := 'alta_complexidade';
    ELSE
      NEW.tipo_faturamento := 'padrao';
    END IF;
  END IF;
  
  -- 9. Garantir data de referência
  IF NEW.data_referencia IS NULL THEN
    NEW.data_referencia := NEW."DATA_REALIZACAO";
  END IF;
  
  -- 10. Marcar para quebra se necessário
  IF EXISTS (
    SELECT 1 FROM regras_quebra_exames 
    WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true
  ) THEN
    NEW.processamento_pendente := true;
  ELSE
    NEW.processamento_pendente := false;
  END IF;
  
  RETURN NEW;
END;
$function$;