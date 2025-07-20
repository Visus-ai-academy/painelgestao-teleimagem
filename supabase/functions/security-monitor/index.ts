import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityEvent {
  type: 'login_attempt' | 'suspicious_activity' | 'data_access' | 'rate_limit' | 'authentication_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  user_email?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, severity, metadata, ip_address, user_agent, user_email }: SecurityEvent = await req.json();

    console.log(`Security event: ${type} - ${severity}`, metadata);

    // Log tentativa de login
    if (type === 'login_attempt') {
      const { data: loginLog, error: loginError } = await supabase
        .from('login_attempts')
        .insert({
          email: user_email || 'unknown',
          ip_address: ip_address || '0.0.0.0',
          success: metadata.success || false,
          failure_reason: metadata.failure_reason || null,
          user_agent: user_agent || null,
          country: metadata.country || null,
          city: metadata.city || null
        });

      if (loginError) {
        console.error('Erro ao registrar tentativa de login:', loginError);
      }
    }

    // Criar alerta de segurança se necessário
    let alertCreated = false;
    if (severity === 'high' || severity === 'critical') {
      const alertTitle = getAlertTitle(type, severity);
      const alertDescription = getAlertDescription(type, metadata);

      const { data: alert, error: alertError } = await supabase
        .rpc('create_security_alert', {
          p_alert_type: type,
          p_severity: severity,
          p_title: alertTitle,
          p_description: alertDescription,
          p_metadata: metadata
        });

      if (alertError) {
        console.error('Erro ao criar alerta de segurança:', alertError);
      } else {
        alertCreated = true;
        console.log('Alerta de segurança criado:', alert);
      }
    }

    // Log de acesso a dados sensíveis
    if (type === 'data_access' && metadata.sensitive) {
      const { data: accessLog, error: accessError } = await supabase
        .rpc('log_data_access', {
          p_resource_type: metadata.resource_type || 'unknown',
          p_resource_id: metadata.resource_id || null,
          p_action: metadata.action || 'ACCESS',
          p_sensitive: true,
          p_classification: metadata.classification || 'confidential'
        });

      if (accessError) {
        console.error('Erro ao registrar acesso a dados:', accessError);
      }
    }

    // Verificar padrões suspeitos e criar alertas automáticos
    await checkSuspiciousPatterns(supabase, type, metadata, ip_address, user_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert_created: alertCreated,
        message: 'Evento de segurança processado' 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erro no monitor de segurança:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

function getAlertTitle(type: string, severity: string): string {
  const titles: Record<string, string> = {
    'login_attempt': `Tentativa de Login ${severity === 'critical' ? 'Múltipla Falhada' : 'Suspeita'}`,
    'suspicious_activity': 'Atividade Suspeita Detectada',
    'data_access': 'Acesso a Dados Sensíveis',
    'rate_limit': 'Limite de Taxa Excedido',
    'authentication_failure': 'Falha de Autenticação'
  };
  return titles[type] || 'Alerta de Segurança';
}

function getAlertDescription(type: string, metadata: Record<string, any>): string {
  switch (type) {
    case 'login_attempt':
      return `${metadata.attempts || 1} tentativas de login falharam para ${metadata.email || 'usuário desconhecido'}`;
    case 'suspicious_activity':
      return `Atividade suspeita detectada: ${metadata.details || 'sem detalhes'}`;
    case 'data_access':
      return `Acesso a dados ${metadata.classification || 'sensíveis'}: ${metadata.resource_type || 'recurso'}`;
    case 'rate_limit':
      return `Limite de ${metadata.limit || 'requisições'} excedido em ${metadata.window || '1 minuto'}`;
    case 'authentication_failure':
      return `Falha na autenticação: ${metadata.reason || 'motivo desconhecido'}`;
    default:
      return 'Evento de segurança detectado';
  }
}

async function checkSuspiciousPatterns(
  supabase: any, 
  type: string, 
  metadata: Record<string, any>, 
  ip_address?: string, 
  user_email?: string
) {
  try {
    // Verificar múltiplas tentativas de login falhadas
    if (type === 'login_attempt' && !metadata.success && user_email) {
      const { data: recentAttempts } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('email', user_email)
        .eq('success', false)
        .gte('timestamp', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // últimos 15 minutos
        .order('timestamp', { ascending: false })
        .limit(5);

      if (recentAttempts && recentAttempts.length >= 5) {
        await supabase.rpc('create_security_alert', {
          p_alert_type: 'authentication_failure',
          p_severity: 'critical',
          p_title: 'Múltiplas Tentativas de Login Falhadas',
          p_description: `5+ tentativas de login falharam para ${user_email} nos últimos 15 minutos`,
          p_metadata: { email: user_email, attempts: recentAttempts.length, ip_addresses: recentAttempts.map(a => a.ip_address) }
        });
      }
    }

    // Verificar acessos de IPs diferentes
    if (ip_address && user_email) {
      const { data: recentIPs } = await supabase
        .from('login_attempts')
        .select('ip_address')
        .eq('email', user_email)
        .eq('success', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // últimas 24 horas
        .neq('ip_address', ip_address);

      if (recentIPs && recentIPs.length > 0) {
        await supabase.rpc('create_security_alert', {
          p_alert_type: 'suspicious_activity',
          p_severity: 'medium',
          p_title: 'Login de IP Diferente',
          p_description: `Login bem-sucedido de novo IP para ${user_email}`,
          p_metadata: { 
            email: user_email, 
            new_ip: ip_address, 
            previous_ips: recentIPs.map(r => r.ip_address).slice(0, 3) 
          }
        });
      }
    }

  } catch (error) {
    console.error('Erro ao verificar padrões suspeitos:', error);
  }
}