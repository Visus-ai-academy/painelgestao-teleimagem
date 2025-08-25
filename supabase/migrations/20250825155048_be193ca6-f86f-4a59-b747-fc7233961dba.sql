-- Criar função para obter timestamp atual do servidor
CREATE OR REPLACE FUNCTION public.get_current_timestamp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'current_timestamp', now(),
    'current_date', current_date,
    'current_time', current_time,
    'timezone', current_setting('timezone'),
    'server_version', version(),
    'year', extract(year from now()),
    'month', extract(month from now()),
    'day', extract(day from now()),
    'hour', extract(hour from now()),
    'minute', extract(minute from now()),
    'second', extract(second from now())
  )::text;
END;
$$;