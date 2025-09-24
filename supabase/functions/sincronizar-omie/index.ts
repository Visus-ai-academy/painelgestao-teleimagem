import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieResponse {
  conta_receber_resumo: Array<{
    codigo_cliente_omie: number;
    codigo_lancamento_omie: number;
    numero_documento: string;
    valor_documento: number;
    data_vencimento: string;
    data_emissao: string;
    status_titulo: string;
    data_pagamento?: string;
    nome_cliente: string;
    email_cliente?: string;
  }>;
}

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
    const omieAppKey = Deno.env.get('OMIE_APP_KEY');
    const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

    if (!omieAppKey || !omieAppSecret) {
      throw new Error('Credenciais do Omie não configuradas');
    }

    console.log('Iniciando sincronização com Omie...');

    // Configuração da requisição para o Omie
    const omiePayload = {
      call: "ListarContasReceber",
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina: 1,
        registros_por_pagina: 100,
        apenas_importado_api: "N"
      }]
    };

    // Fazendo a requisição para a API do Omie
    const omieResponse = await fetch('https://app.omie.com.br/api/v1/financas/contareceber/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(omiePayload)
    });

    if (!omieResponse.ok) {
      throw new Error(`Erro na API do Omie: ${omieResponse.status}`);
    }

    const omieData: OmieResponse = await omieResponse.json();
    console.log(`Recebidas ${omieData.conta_receber_resumo?.length || 0} faturas do Omie`);

    let faturasSincronizadas = 0;

    if (omieData.conta_receber_resumo && omieData.conta_receber_resumo.length > 0) {
      // Processar cada fatura do Omie
      for (const fatura of omieData.conta_receber_resumo) {
        const faturaData = {
          omie_id: fatura.codigo_lancamento_omie.toString(),
          cliente_nome: fatura.nome_cliente,
          cliente_email: fatura.email_cliente || '',
          numero_fatura: fatura.numero_documento,
          valor: fatura.valor_documento,
          data_emissao: fatura.data_emissao,
          data_vencimento: fatura.data_vencimento,
          status: mapearStatusOmie(fatura.status_titulo),
          data_pagamento: fatura.data_pagamento || null,
          sync_date: new Date().toISOString()
        };

        // Inserir ou atualizar fatura
        const { error: upsertError } = await supabase
          .from('omie_faturas')
          .upsert(faturaData, {
            onConflict: 'omie_id'
          });

        if (upsertError) {
          console.error('Erro ao inserir fatura:', upsertError);
        } else {
          faturasSincronizadas++;
        }
      }

      // Verificar faturas vencidas e criar réguas de cobrança
      await criarReguasCobranca();
    }

    console.log(`Sincronização concluída: ${faturasSincronizadas} faturas processadas`);

    return new Response(
      JSON.stringify({ 
        sucesso: true, 
        faturas_sincronizadas: faturasSincronizadas 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro na sincronização:', error);
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

function mapearStatusOmie(statusOmie: string): 'pago' | 'em_aberto' | 'cancelado' {
  switch (statusOmie.toLowerCase()) {
    case 'liquidado':
    case 'pago':
      return 'pago';
    case 'cancelado':
      return 'cancelado';
    default:
      return 'em_aberto';
  }
}

async function criarReguasCobranca() {
  try {
    // Buscar faturas vencidas sem régua de cobrança
    const hoje = new Date().toISOString().split('T')[0];
    
    const { data: faturasVencidas, error } = await supabase
      .from('omie_faturas')
      .select(`
        id,
        data_vencimento,
        status,
        cliente_email
      `)
      .eq('status', 'em_aberto')
      .lt('data_vencimento', hoje)
      .not('cliente_email', 'is', null)
      .not('cliente_email', 'eq', '');

    if (error) {
      console.error('Erro ao buscar faturas vencidas:', error);
      return;
    }

    if (!faturasVencidas || faturasVencidas.length === 0) {
      console.log('Nenhuma fatura vencida encontrada');
      return;
    }

    // Para cada fatura vencida, verificar se já existe régua de cobrança
    for (const fatura of faturasVencidas) {
      const { data: reguaExistente } = await supabase
        .from('regua_cobranca')
        .select('id')
        .eq('fatura_id', fatura.id)
        .eq('ativo', true)
        .single();

      if (!reguaExistente) {
        // Criar nova régua de cobrança
        const proximoEnvio = new Date();
        proximoEnvio.setDate(proximoEnvio.getDate() + 1); // Primeiro email no dia seguinte

        const { error: reguaError } = await supabase
          .from('regua_cobranca')
          .insert({
            fatura_id: fatura.id,
            dias_envio: 0,
            proximo_envio: proximoEnvio.toISOString().split('T')[0],
            emails_enviados: 0,
            max_emails: 10,
            ativo: true
          });

        if (reguaError) {
          console.error('Erro ao criar régua de cobrança:', reguaError);
        } else {
          console.log(`Régua de cobrança criada para fatura ${fatura.id}`);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao criar réguas de cobrança:', error);
  }
}

serve(handler);