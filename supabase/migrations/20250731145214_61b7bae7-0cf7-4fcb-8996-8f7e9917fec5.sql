-- Criar tabela para armazenar o De-Para Prioridade
CREATE TABLE public.valores_prioridade_de_para (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prioridade_original TEXT NOT NULL,
  nome_final TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar índice para otimizar consultas
CREATE INDEX idx_valores_prioridade_original ON public.valores_prioridade_de_para(prioridade_original);

-- Habilitar RLS
ALTER TABLE public.valores_prioridade_de_para ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar de-para prioridade" 
ON public.valores_prioridade_de_para 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver de-para prioridade" 
ON public.valores_prioridade_de_para 
FOR SELECT 
USING (is_manager_or_admin());

-- Função para aplicar De-Para Prioridade
CREATE OR REPLACE FUNCTION public.aplicar_de_para_prioridade()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  registros_atualizados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar De-Para Prioridade nos dados de volumetria
  UPDATE volumetria_mobilemed vm
  SET "PRIORIDADE" = vp.nome_final,
      updated_at = now()
  FROM valores_prioridade_de_para vp
  WHERE vm."PRIORIDADE" = vp.prioridade_original
    AND vp.ativo = true;
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para_prioridade', 
          jsonb_build_object('registros_atualizados', registros_atualizados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;

-- Trigger para aplicar De-Para automaticamente
CREATE OR REPLACE FUNCTION public.aplicar_de_para_prioridade_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nome_final_valor TEXT;
BEGIN
  -- Buscar o valor final para a prioridade
  SELECT nome_final INTO nome_final_valor
  FROM valores_prioridade_de_para
  WHERE prioridade_original = NEW."PRIORIDADE"
    AND ativo = true
  LIMIT 1;
  
  -- Se encontrou um mapeamento, aplicar
  IF nome_final_valor IS NOT NULL THEN
    NEW."PRIORIDADE" = nome_final_valor;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para aplicar automaticamente no INSERT
CREATE TRIGGER trigger_aplicar_de_para_prioridade
  BEFORE INSERT ON volumetria_mobilemed
  FOR EACH ROW
  EXECUTE FUNCTION aplicar_de_para_prioridade_trigger();