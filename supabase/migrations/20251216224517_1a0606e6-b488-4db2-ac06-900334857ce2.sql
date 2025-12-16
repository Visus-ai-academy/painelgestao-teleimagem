-- Corrigir search_path nas funções SEGURAS (não impactam volumetria/faturamento)

-- 1. classificar_tipo_pessoa
CREATE OR REPLACE FUNCTION public.classificar_tipo_pessoa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' THEN
    NEW.tipo_pessoa := 'PJ';
  ELSIF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    NEW.tipo_pessoa := 'PF';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. fazer_checkin_ativacao
CREATE OR REPLACE FUNCTION public.fazer_checkin_ativacao(p_escala_id uuid, p_medico_id uuid, p_dispositivo_info jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ativacao_id uuid;
  v_resultado jsonb;
BEGIN
  INSERT INTO ativacao_medico (
    escala_id,
    medico_id,
    data_ativacao,
    status_ativacao,
    horario_checkin,
    dispositivo_info
  ) VALUES (
    p_escala_id,
    p_medico_id,
    CURRENT_DATE,
    'ativo',
    CURRENT_TIMESTAMP,
    p_dispositivo_info
  )
  RETURNING id INTO v_ativacao_id;
  
  v_resultado := jsonb_build_object(
    'sucesso', true,
    'ativacao_id', v_ativacao_id,
    'horario_checkin', CURRENT_TIMESTAMP,
    'mensagem', 'Check-in realizado com sucesso'
  );
  
  RETURN v_resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', SQLERRM
    );
END;
$function$;

-- 3. fazer_checkout_ativacao
CREATE OR REPLACE FUNCTION public.fazer_checkout_ativacao(p_ativacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_resultado jsonb;
BEGIN
  UPDATE ativacao_medico
  SET 
    status_ativacao = 'finalizado',
    horario_checkout = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_ativacao_id
  AND status_ativacao = 'ativo';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', 'Ativação não encontrada ou já finalizada'
    );
  END IF;
  
  v_resultado := jsonb_build_object(
    'sucesso', true,
    'horario_checkout', CURRENT_TIMESTAMP,
    'mensagem', 'Check-out realizado com sucesso'
  );
  
  RETURN v_resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', SQLERRM
    );
END;
$function$;

-- 4. get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_roles.user_id = get_user_role.user_id;
  
  RETURN COALESCE(user_role, 'viewer');
END;
$function$;

-- 5. handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 6. has_role
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid();
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  IF required_role = 'viewer' THEN
    RETURN true;
  ELSIF required_role = 'operator' THEN
    RETURN user_role IN ('operator', 'manager', 'admin');
  ELSIF required_role = 'manager' THEN
    RETURN user_role IN ('manager', 'admin');
  ELSIF required_role = 'admin' THEN
    RETURN user_role = 'admin';
  END IF;
  
  RETURN false;
END;
$function$;

-- 7. is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$function$;

-- 8. is_manager_or_admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid();
  
  RETURN user_role IN ('manager', 'admin');
END;
$function$;

-- 9. log_volumetria_exclusao_detalhada
CREATE OR REPLACE FUNCTION public.log_volumetria_exclusao_detalhada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    operation,
    old_data,
    user_id,
    user_email
  ) VALUES (
    'volumetria_mobilemed',
    OLD.id::text,
    'DELETE',
    to_jsonb(OLD),
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );
  RETURN OLD;
END;
$function$;

-- 10. normalizar_nome_medico
CREATE OR REPLACE FUNCTION public.normalizar_nome_medico(nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN UPPER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRANSLATE(nome, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
        '^\s*(dr\.?|dra\.?)\s*', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  ));
END;
$function$;

-- 11. obter_status_ativacao_atual
CREATE OR REPLACE FUNCTION public.obter_status_ativacao_atual(p_medico_id uuid, p_data date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_resultado jsonb;
  v_ativacao record;
BEGIN
  SELECT * INTO v_ativacao
  FROM ativacao_medico
  WHERE medico_id = p_medico_id
  AND data_ativacao = p_data
  AND status_ativacao = 'ativo'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_ativacao IS NULL THEN
    RETURN jsonb_build_object(
      'ativo', false,
      'mensagem', 'Nenhuma ativação encontrada para hoje'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ativo', true,
    'ativacao_id', v_ativacao.id,
    'escala_id', v_ativacao.escala_id,
    'horario_checkin', v_ativacao.horario_checkin,
    'status', v_ativacao.status_ativacao
  );
END;
$function$;

-- 12. processar_checkout_automatico
CREATE OR REPLACE FUNCTION public.processar_checkout_automatico()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE ativacao_medico
  SET 
    status_ativacao = 'finalizado',
    horario_checkout = CURRENT_TIMESTAMP,
    checkout_automatico = true,
    updated_at = CURRENT_TIMESTAMP
  WHERE status_ativacao = 'ativo'
  AND data_ativacao < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$function$;

-- 13. processar_tasks_sistema
CREATE OR REPLACE FUNCTION public.processar_tasks_sistema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_resultado jsonb;
  v_checkouts integer;
BEGIN
  SELECT processar_checkout_automatico() INTO v_checkouts;
  
  v_resultado := jsonb_build_object(
    'sucesso', true,
    'checkouts_processados', v_checkouts,
    'processado_em', CURRENT_TIMESTAMP
  );
  
  RETURN v_resultado;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'erro', SQLERRM
    );
END;
$function$;

-- 14. promote_user_to_admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem promover usuários';
  END IF;
  
  UPDATE user_roles
  SET role = 'admin', updated_at = CURRENT_TIMESTAMP
  WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (target_user_id, 'admin');
  END IF;
END;
$function$;

-- 15. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- 16. update_demonstrativos_calculados_updated_at
CREATE OR REPLACE FUNCTION public.update_demonstrativos_calculados_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- 17. vincular_parametro_cliente
CREATE OR REPLACE FUNCTION public.vincular_parametro_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cliente_id uuid;
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.nome_fantasia IS NOT NULL THEN
    SELECT id INTO v_cliente_id
    FROM clientes
    WHERE nome_fantasia = NEW.nome_fantasia
    OR nome = NEW.nome_fantasia
    LIMIT 1;
    
    IF v_cliente_id IS NOT NULL THEN
      NEW.cliente_id := v_cliente_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;