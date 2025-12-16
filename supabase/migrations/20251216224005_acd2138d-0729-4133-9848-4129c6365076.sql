-- ===========================================
-- CORREÇÃO DE SEGURANÇA: RLS, Views e Functions
-- ===========================================

-- 1. HABILITAR RLS NA TABELA system_tasks
ALTER TABLE public.system_tasks ENABLE ROW LEVEL SECURITY;

-- Criar policy para permitir apenas admins/managers
CREATE POLICY "Admins_managers_can_access_system_tasks" ON public.system_tasks
FOR ALL USING (
  public.has_role((select auth.uid()), 'admin') OR public.has_role((select auth.uid()), 'manager')
);

-- 2. CORRIGIR VIEWS SECURITY DEFINER (remover e recriar como SECURITY INVOKER)
DROP VIEW IF EXISTS public.performance_dashboard;
CREATE VIEW public.performance_dashboard 
WITH (security_invoker = true)
AS
SELECT 
  DATE_TRUNC('hour', pl.timestamp) as hora,
  pl.operation,
  pl.table_name,
  AVG(pl.query_time) as duracao_media_ms,
  MAX(pl.query_time) as duracao_max_ms,
  COUNT(*) as total_operacoes
FROM performance_logs pl
WHERE pl.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', pl.timestamp), pl.operation, pl.table_name
ORDER BY hora DESC;

DROP VIEW IF EXISTS public.security_metrics_view;
CREATE VIEW public.security_metrics_view
WITH (security_invoker = true)
AS
SELECT 
  DATE_TRUNC('day', la.timestamp) as dia,
  COUNT(*) FILTER (WHERE la.success = true) as logins_sucesso,
  COUNT(*) FILTER (WHERE la.success = false) as logins_falha,
  COUNT(DISTINCT la.email) as usuarios_unicos
FROM login_attempts la
WHERE la.timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', la.timestamp)
ORDER BY dia DESC;

-- 3. CORRIGIR FUNCTIONS SEM SEARCH_PATH

CREATE OR REPLACE FUNCTION public.aplicar_especialidade_automatica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW."ESPECIALIDADE" IS NULL OR NEW."ESPECIALIDADE" = '' THEN
    SELECT ce.especialidade INTO NEW."ESPECIALIDADE"
    FROM cadastro_exames ce
    WHERE ce.nome = NEW."ESTUDO_DESCRICAO"
      AND ce.ativo = true
      AND ce.especialidade IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_mapeamento_nome_fantasia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT c.nome_fantasia INTO NEW."Cliente_Nome_Fantasia"
  FROM clientes c
  WHERE TRIM(c.nome_mobilemed) = TRIM(NEW."EMPRESA")
  LIMIT 1;
  
  IF NEW."Cliente_Nome_Fantasia" IS NULL THEN
    SELECT c.nome_fantasia INTO NEW."Cliente_Nome_Fantasia"
    FROM clientes c
    WHERE TRIM(c.nome) = TRIM(NEW."EMPRESA")
    LIMIT 1;
  END IF;
  
  IF NEW."Cliente_Nome_Fantasia" IS NULL THEN
    NEW."Cliente_Nome_Fantasia" := NEW."EMPRESA";
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_prioridades_de_para()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  nova_prioridade TEXT;
BEGIN
  SELECT vp.nome_final INTO nova_prioridade
  FROM valores_prioridade_de_para vp
  WHERE vp.prioridade_original = NEW."PRIORIDADE"
    AND vp.ativo = true
  LIMIT 1;
  
  IF nova_prioridade IS NOT NULL THEN
    NEW."PRIORIDADE" := nova_prioridade;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_regra_f007_medicina_interna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_regras_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.processamento_pendente := true;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_regras_periodo_automatico(p_periodo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resultado jsonb;
BEGIN
  resultado := jsonb_build_object('sucesso', true, 'periodo', p_periodo, 'total_processados', 0);
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_valor_onco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_data(data_referencia date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.classificar_tipo_pessoa(documento text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF documento IS NULL OR documento = '' THEN RETURN NULL; END IF;
  documento := regexp_replace(documento, '[^0-9]', '', 'g');
  IF LENGTH(documento) = 11 THEN RETURN 'PF';
  ELSIF LENGTH(documento) = 14 THEN RETURN 'PJ';
  ELSE RETURN NULL; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.detectar_tipo_documento(documento text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF documento IS NULL OR documento = '' THEN RETURN NULL; END IF;
  documento := regexp_replace(documento, '[^0-9]', '', 'g');
  IF LENGTH(documento) = 11 THEN RETURN 'CPF';
  ELSIF LENGTH(documento) = 14 THEN RETURN 'CNPJ';
  ELSE RETURN 'OUTRO'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fazer_checkin_ativacao(p_escala_id uuid, p_medico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resultado jsonb;
  v_ativacao_id uuid;
BEGIN
  INSERT INTO ativacao_medico (escala_id, medico_id, data_ativacao, horario_checkin, status_ativacao)
  VALUES (p_escala_id, p_medico_id, CURRENT_DATE, CURRENT_TIME, 'ativo')
  RETURNING id INTO v_ativacao_id;
  resultado := jsonb_build_object('sucesso', true, 'ativacao_id', v_ativacao_id, 'horario', CURRENT_TIME);
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fazer_checkout_ativacao(p_ativacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resultado jsonb;
BEGIN
  UPDATE ativacao_medico SET horario_checkout = CURRENT_TIME, status_ativacao = 'finalizado', updated_at = NOW() WHERE id = p_ativacao_id;
  resultado := jsonb_build_object('sucesso', true, 'ativacao_id', p_ativacao_id, 'horario_checkout', CURRENT_TIME);
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_regras_aplicadas_stats(p_periodo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resultado jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_registros', COUNT(*),
    'com_categoria', COUNT(*) FILTER (WHERE "CATEGORIA" IS NOT NULL AND "CATEGORIA" != ''),
    'com_especialidade', COUNT(*) FILTER (WHERE "ESPECIALIDADE" IS NOT NULL AND "ESPECIALIDADE" != ''),
    'com_tipificacao', COUNT(*) FILTER (WHERE tipo_faturamento IS NOT NULL),
    'periodo', COALESCE(p_periodo, 'todos')
  ) INTO resultado
  FROM volumetria_mobilemed
  WHERE p_periodo IS NULL OR periodo_referencia = p_periodo;
  RETURN resultado;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_auto_aplicar_regras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    DECLARE v_lote_upload text;
    BEGIN
      v_lote_upload := NEW.detalhes_erro->>'lote_upload';
      IF v_lote_upload IS NOT NULL THEN
        INSERT INTO system_tasks (task_type, task_data, status, priority, attempts, max_attempts)
        VALUES ('APLICAR_REGRAS_AUTO', jsonb_build_object('arquivo_fonte', NEW.tipo_arquivo, 'lote_upload', v_lote_upload, 'upload_id', NEW.id::text), 'pendente', 1, 0, 3);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_normalizar_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW."MEDICO" IS NOT NULL THEN NEW."MEDICO" := normalizar_medico(NEW."MEDICO"); END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_limpar_nome_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW."EMPRESA" IS NOT NULL AND NEW."EMPRESA" != '' THEN NEW."EMPRESA" := limpar_nome_cliente(NEW."EMPRESA"); END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_marcar_para_quebra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM regras_quebra_exames WHERE exame_original = NEW."ESTUDO_DESCRICAO" AND ativo = true) THEN
    NEW.processamento_pendente := true;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'DELETE'::text, OLD.id::text, row_to_json(OLD)::jsonb, NULL::jsonb);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'UPDATE'::text, NEW.id::text, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(TG_TABLE_NAME::text, 'INSERT'::text, NEW.id::text, NULL::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.round_precos_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.valor_base IS NOT NULL THEN NEW.valor_base := ROUND(NEW.valor_base::numeric, 2); END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalizar_medico(medico_nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF medico_nome IS NULL OR medico_nome = '' THEN RETURN medico_nome; END IF;
  medico_nome := regexp_replace(medico_nome, '\s*\([^)]*\)\s*', '', 'g');
  medico_nome := regexp_replace(medico_nome, '^DR[A]?\s+', '', 'i');
  medico_nome := regexp_replace(medico_nome, '\.$', '');
  RETURN trim(medico_nome);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_medicos_adicionais_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_fila_sincronizacao_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_relatorios_faturamento_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;