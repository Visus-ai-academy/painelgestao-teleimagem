-- Criar tabela para armazenar dados "De Para"
CREATE TABLE public.valores_referencia_de_para (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estudo_descricao TEXT NOT NULL,
  valores NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(estudo_descricao)
);

-- Habilitar RLS
ALTER TABLE public.valores_referencia_de_para ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar valores referência" 
ON public.valores_referencia_de_para 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Managers podem ver valores referência" 
ON public.valores_referencia_de_para 
FOR SELECT 
USING (is_manager_or_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_valores_referencia_de_para_updated_at
BEFORE UPDATE ON public.valores_referencia_de_para
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para aplicar valores "De Para" nos dados existentes
CREATE OR REPLACE FUNCTION public.aplicar_valores_de_para()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  registros_atualizados INTEGER := 0;
  registros_processados INTEGER := 0;
  resultado JSONB;
BEGIN
  -- Aplicar valores de referência nos dados com VALORES zerados ou nulos
  UPDATE volumetria_mobilemed vm
  SET "VALORES" = vr.valores,
      updated_at = now()
  FROM valores_referencia_de_para vr
  WHERE vm."ESTUDO_DESCRICAO" = vr.estudo_descricao
    AND vr.ativo = true
    AND (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte IN ('volumetria_fora_padrao', 'fora_padrao');
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  
  -- Contar total de registros processados
  SELECT COUNT(*) INTO registros_processados
  FROM volumetria_mobilemed vm
  WHERE (vm."VALORES" = 0 OR vm."VALORES" IS NULL)
    AND vm.arquivo_fonte IN ('volumetria_fora_padrao', 'fora_padrao');
  
  -- Log da operação
  INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_email, severity)
  VALUES ('volumetria_mobilemed', 'UPDATE', 'bulk_de_para', 
          jsonb_build_object('registros_atualizados', registros_atualizados, 'registros_processados', registros_processados),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'), 'info');
  
  -- Retornar resultado
  resultado := jsonb_build_object(
    'sucesso', true,
    'registros_atualizados', registros_atualizados,
    'registros_ainda_zerados', registros_processados,
    'data_processamento', now()
  );
  
  RETURN resultado;
END;
$$;