import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cliente_id, cliente_nome, periodo, valor_bruto } = await req.json();

    console.log('=== GERAR NF NO OMIE ===');
    console.log('Cliente:', cliente_nome);
    console.log('Período:', periodo);
    console.log('Valor Bruto:', valor_bruto);

    const omieApiKey = Deno.env.get('OMIE_API_KEY');
    const omieApiSecret = Deno.env.get('OMIE_API_SECRET');

    if (!omieApiKey || !omieApiSecret) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Credenciais da API do Omie não configuradas' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do cliente
    const { data: clienteData, error: clienteError } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !clienteData) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Cliente não encontrado' 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Dados para a API do Omie
    const nfData = {
      call: 'IncluirNF',
      app_key: omieApiKey,
      app_secret: omieApiSecret,
      param: [{
        ide: {
          cSerie: '1',
          dDtEmi: new Date().toISOString().split('T')[0],
          tpNF: '1'
        },
        dest: {
          xNome: clienteData.nome,
          CNPJCPF: clienteData.cnpj?.replace(/\D/g, '') || '',
          xLgr: clienteData.endereco || 'Não informado',
          nro: clienteData.numero || 'S/N',
          xBairro: clienteData.bairro || 'Centro',
          xMun: clienteData.cidade || 'Não informado',
          UF: clienteData.estado || 'SP',
          CEP: clienteData.cep?.replace(/\D/g, '') || ''
        },
        det: [{
          prod: {
            cProd: '001',
            xProd: `Serviços de Laudos - ${periodo}`,
            uCom: 'UN',
            qCom: 1,
            vUnCom: valor_bruto,
            vProd: valor_bruto
          }
        }],
        total: {
          vProd: valor_bruto,
          vNF: valor_bruto
        }
      }]
    };

    const omieResponse = await fetch('https://app.omie.com.br/api/v1/geral/nfe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nfData)
    });

    const omieResult = await omieResponse.json();

    if (!omieResponse.ok || omieResult.faultstring) {
      const errorMsg = omieResult.faultstring || 'Erro na API do Omie';
      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      cliente: cliente_nome,
      periodo,
      valor_bruto,
      nf_numero: omieResult.nNF,
      omie_response: omieResult
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});