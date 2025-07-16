import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { faturaIds } = await req.json();

    if (!faturaIds || !Array.isArray(faturaIds) || faturaIds.length === 0) {
      throw new Error('IDs das faturas são obrigatórios');
    }

    console.log(`Ativando régua de cobrança para ${faturaIds.length} faturas`);

    let reguasAtivadas = 0;

    for (const faturaId of faturaIds) {
      // Verificar se a fatura existe e está em aberto
      const { data: fatura, error: faturaError } = await supabase
        .from('omie_faturas')
        .select('id, status, cliente_email, data_vencimento')
        .eq('id', faturaId)
        .eq('status', 'em_aberto')
        .single();

      if (faturaError || !fatura) {
        console.log(`Fatura ${faturaId} não encontrada ou não está em aberto`);
        continue;
      }

      if (!fatura.cliente_email) {
        console.log(`Fatura ${faturaId} não possui email do cliente`);
        continue;
      }

      // Verificar se já existe régua ativa para esta fatura
      const { data: reguaExistente } = await supabase
        .from('regua_cobranca')
        .select('id')
        .eq('fatura_id', faturaId)
        .eq('ativo', true)
        .single();

      if (reguaExistente) {
        console.log(`Régua já existe para fatura ${faturaId}`);
        continue;
      }

      // Calcular próximo envio baseado na data de vencimento
      const dataVencimento = new Date(fatura.data_vencimento);
      const hoje = new Date();
      const proximoEnvio = new Date();
      
      if (dataVencimento <= hoje) {
        // Se já venceu, enviar no próximo dia útil
        proximoEnvio.setDate(hoje.getDate() + 1);
      } else {
        // Se ainda não venceu, enviar um dia após o vencimento
        proximoEnvio.setTime(dataVencimento.getTime());
        proximoEnvio.setDate(proximoEnvio.getDate() + 1);
      }

      // Criar régua de cobrança
      const { error: reguaError } = await supabase
        .from('regua_cobranca')
        .insert({
          fatura_id: faturaId,
          dias_envio: 0,
          proximo_envio: proximoEnvio.toISOString().split('T')[0],
          emails_enviados: 0,
          max_emails: 10,
          ativo: true
        });

      if (reguaError) {
        console.error(`Erro ao criar régua para fatura ${faturaId}:`, reguaError);
      } else {
        reguasAtivadas++;
        console.log(`Régua ativada para fatura ${faturaId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        reguas_ativadas: reguasAtivadas,
        total_processadas: faturaIds.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro ao ativar régua de cobrança:', error);
    return new Response(
      JSON.stringify({ 
        erro: true, 
        mensagem: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);