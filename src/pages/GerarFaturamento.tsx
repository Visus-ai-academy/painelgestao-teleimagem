import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cliente_id, cliente_nome, periodo, valor_bruto } = await req.json();

    console.log('=== GERAR NF NO OMIE ===');
    console.log('Cliente ID:', cliente_id);
    console.log('Cliente Nome:', cliente_nome);
    console.log('Período:', periodo);
    console.log('Valor Bruto:', valor_bruto);

    // Verificar credenciais da API do Omie
    const omieApiKey = Deno.env.get('OMIE_API_KEY');
    const omieApiSecret = Deno.env.get('OMIE_API_SECRET');

    if (!omieApiKey || !omieApiSecret) {
      console.error('Credenciais do Omie não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Credenciais da API do Omie não configuradas' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados completos do cliente
    const { data: clienteData, error: clienteError } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !clienteData) {
      console.error('Erro ao buscar cliente:', clienteError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Cliente não encontrado' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Preparar dados para a API do Omie
    const nfData = {
      call: 'IncluirNF',
      app_key: omieApiKey,
      app_secret: omieApiSecret,
      param: [{
        ide: {
          cSerie: '1',
          dDtEmi: new Date().toISOString().split('T')[0], // Data atual YYYY-MM-DD
          nNF: null, // Omie gera automaticamente
          tpNF: '1' // Saída
        },
        dest: {
          xNome: clienteData.nome,
          CNPJCPF: clienteData.cnpj?.replace(/\D/g, '') || '',
          xLgr: clienteData.endereco || 'Não informado',
          nro: clienteData.numero || 'S/N',
          xBairro: clienteData.bairro || 'Centro',
          xMun: clienteData.cidade || 'Não informado',
          UF: clienteData.estado || 'SP',
          CEP: clienteData.cep?.replace(/\D/g, '') || '',
          fone: clienteData.telefone || '',
          email: clienteData.email || ''
        },
        det: [{
          prod: {
            cProd: '001',
            xProd: `Serviços de Laudos - ${periodo}`,
            uCom: 'UN',
            qCom: 1,
            vUnCom: valor_bruto,
            vProd: valor_bruto
          },
          imposto: {
            ICMS: {
              orig: '0',
              CST: '00',
              pICMS: 0,
              vICMS: 0
            },
            PIS: {
              CST: '07',
              pPIS: 0.65,
              vPIS: Math.round(valor_bruto * 0.0065 * 100) / 100
            },
            COFINS: {
              CST: '07',
              pCOFINS: 3.0,
              vCOFINS: Math.round(valor_bruto * 0.03 * 100) / 100
            }
          }
        }],
        total: {
          vBC: valor_bruto,
          vICMS: 0,
          vBCST: 0,
          vST: 0,
          vProd: valor_bruto,
          vFrete: 0,
          vSeg: 0,
          vDesc: 0,
          vII: 0,
          vIPI: 0,
          vPIS: Math.round(valor_bruto * 0.0065 * 100) / 100,
          vCOFINS: Math.round(valor_bruto * 0.03 * 100) / 100,
          vOutro: 0,
          vNF: valor_bruto
        },
        infAdic: {
          infCpl: `Referente aos serviços de laudos do período ${periodo}`
        }
      }]
    };

    console.log('Enviando para API do Omie:', JSON.stringify(nfData, null, 2));

    // Chamar API do Omie
    const omieResponse = await fetch('https://app.omie.com.br/api/v1/geral/nfe/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nfData)
    });

    const omieResult = await omieResponse.json();
    console.log('Resposta da API Omie:', JSON.stringify(omieResult, null, 2));

    if (!omieResponse.ok || omieResult.faultstring) {
      const errorMsg = omieResult.faultstring || omieResult.error || 'Erro na API do Omie';
      console.error('Erro na API do Omie:', errorMsg);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMsg,
          details: omieResult
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log da operação de sucesso
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'omie_integration',
        operation: 'GERAR_NF',
        record_id: cliente_id,
        new_data: {
          cliente_nome,
          periodo,
          valor_bruto,
          nf_numero: omieResult.nNF,
          nf_serie: omieResult.cSerie,
          response: omieResult
        },
        user_email: 'system',
        severity: 'info'
      });

    console.log('NF gerada com sucesso no Omie');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Nota fiscal gerada com sucesso no Omie',
        cliente: cliente_nome,
        periodo,
        valor_bruto,
        nf_numero: omieResult.nNF,
        nf_serie: omieResult.cSerie,
        nf_chave: omieResult.chNFe,
        omie_response: omieResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro na função gerar-nf-omie:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: 'Erro interno na função de geração de NF'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});