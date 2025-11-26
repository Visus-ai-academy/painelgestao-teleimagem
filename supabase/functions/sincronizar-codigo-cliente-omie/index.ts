import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function converterDataOmie(dataOmie: string): string | null {
  if (!dataOmie) return null;
  const partes = dataOmie.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

async function buscarClienteOmie(cnpj: string, nomeCliente: string, appKey: string, appSecret: string) {
  const digits = (cnpj || '').replace(/\D/g, '');
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const alvoNome = norm(nomeCliente);

  for (let pagina = 1; pagina <= 50; pagina++) {
    const response = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: "ListarClientes",
        app_key: appKey,
        app_secret: appSecret,
        param: [{ pagina, registros_por_pagina: 100 }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status} - ${response.statusText}`);
    }

    const dados = await response.json();
    const lista = dados.clientes_cadastro || [];

    if (lista.length === 0) break;

    let clienteEncontrado = lista.find((cliente: any) => {
      const cnpjResp = String(cliente.cnpj_cpf || '').replace(/\D/g, '');
      return cnpjResp && digits && cnpjResp === digits;
    });

    if (!clienteEncontrado && alvoNome) {
      clienteEncontrado = lista.find((cliente: any) =>
        norm(cliente.razao_social).includes(alvoNome) ||
        norm(cliente.nome_fantasia).includes(alvoNome)
      );
    }

    if (clienteEncontrado) {
      return {
        codigo_omie: clienteEncontrado.codigo_cliente_omie,
        razao_social: clienteEncontrado.razao_social,
        nome_fantasia: clienteEncontrado.nome_fantasia,
        cnpj: clienteEncontrado.cnpj_cpf,
      };
    }

    if (lista.length < 100) break;
  }

  return null;
}

async function buscarContratosOmie(codigoClienteOmie: string, appKey: string, appSecret: string) {
  const contratos: any[] = [];
  let paginasSemResultado = 0;
  
  console.log(`🔍 Buscando contratos para cliente OMIE: ${codigoClienteOmie}`);

  for (let pagina = 1; pagina <= 10; pagina++) {
    const response = await fetch('https://app.omie.com.br/api/v1/servicos/contrato/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: "ListarContratos",
        app_key: appKey,
        app_secret: appSecret,
        param: [{
          pagina,
          registros_por_pagina: 100,
          apenas_importado_api: 'N'
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na API OMIE - Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`Erro na API do OMIE: ${response.status} - ${response.statusText}`);
    }

    const dados = await response.json();
    const lista = dados.contratoCadastro || [];

    if (lista.length === 0) break;
    
    // Filtrar contratos deste cliente
    const contratosCliente = lista.filter((contrato: any) => 
      contrato.cabecalho?.nCodCli && String(contrato.cabecalho.nCodCli) === String(codigoClienteOmie)
    );
    
    console.log(`📄 Página ${pagina}: ${contratosCliente.length} contratos do cliente`);
    contratos.push(...contratosCliente);
    
    // Se não encontrou nenhum contrato do cliente nesta página, incrementa contador
    if (contratosCliente.length === 0) {
      paginasSemResultado++;
      // Se 3 páginas seguidas sem resultados, para de buscar
      if (paginasSemResultado >= 3) {
        console.log(`⏹️ Parando busca: 3 páginas sem contratos do cliente`);
        break;
      }
    } else {
      paginasSemResultado = 0; // Reseta contador se encontrou contratos
    }
    
    if (lista.length < 100) break;
  }
  
  console.log(`✅ Total de contratos encontrados: ${contratos.length}`);
  return contratos;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const omieAppKey = Deno.env.get('OMIE_APP_KEY');
    const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

    if (!omieAppKey || !omieAppSecret) {
      throw new Error('Credenciais OMIE não configuradas. Verifique OMIE_APP_KEY e OMIE_APP_SECRET.');
    }

    const body = await req.json();
    const { cliente_id, test_credentials } = body;

    // Endpoint para testar credenciais
    if (test_credentials) {
      console.log('🔐 Testando credenciais OMIE...');
      
      try {
        const testResponse = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call: "ListarClientes",
            app_key: omieAppKey,
            app_secret: omieAppSecret,
            param: [{ pagina: 1, registros_por_pagina: 1 }],
          }),
        });

        const statusCode = testResponse.status;
        console.log(`📡 Status da API OMIE: ${statusCode}`);

        if (statusCode === 500) {
          return new Response(JSON.stringify({
            success: false,
            valid: false,
            message: '❌ Credenciais INVÁLIDAS - API retornou erro 500',
            details: 'Verifique se OMIE_APP_KEY e OMIE_APP_SECRET estão corretos no painel OMIE'
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (!testResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            valid: false,
            message: `❌ Erro na API OMIE - Status ${statusCode}`,
            details: await testResponse.text()
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        const data = await testResponse.json();
        
        return new Response(JSON.stringify({
          success: true,
          valid: true,
          message: '✅ Credenciais VÁLIDAS - API OMIE funcionando!',
          details: `Total de registros acessíveis: ${data.total_de_registros || 'N/A'}`
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

      } catch (error: any) {
        console.error('❌ Erro ao testar credenciais:', error);
        return new Response(JSON.stringify({
          success: false,
          valid: false,
          message: '❌ Erro ao conectar com API OMIE',
          details: error.message
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    if (!cliente_id) {
      throw new Error('cliente_id é obrigatório');
    }

    console.log(`Processando cliente ID: ${cliente_id}`);

    // Buscar dados do cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome, cnpj, omie_codigo_cliente')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error('Cliente não encontrado');
    }

    let codigoOmie = cliente.omie_codigo_cliente;

    // Se não tem código OMIE, buscar
    if (!codigoOmie) {
      if (!cliente.cnpj) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Cliente sem CNPJ',
          cliente_nome: cliente.nome
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const encontrado = await buscarClienteOmie(cliente.cnpj, cliente.nome, omieAppKey, omieAppSecret);
      
      if (!encontrado?.codigo_omie) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Cliente não encontrado no OMIE',
          cliente_nome: cliente.nome
        }), { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      codigoOmie = String(encontrado.codigo_omie);

      await supabase
        .from('clientes')
        .update({ 
          omie_codigo_cliente: codigoOmie,
          omie_data_sincronizacao: new Date().toISOString()
        })
        .eq('id', cliente.id);
    }

    // Buscar contratos do cliente
    const { data: contratosCliente } = await supabase
      .from('contratos_clientes')
      .select('id, numero_contrato, data_inicio, data_fim')
      .eq('cliente_id', cliente.id)
      .in('status', ['ativo', 'vencido']);

    console.log(`📋 Contratos no banco local: ${contratosCliente?.length || 0}`);
    if (contratosCliente && contratosCliente.length > 0) {
      console.log(`📋 Números de contrato no banco:`, contratosCliente.map(c => c.numero_contrato));
    }

    // Buscar contratos no OMIE
    const contratosOmie = await buscarContratosOmie(codigoOmie, omieAppKey, omieAppSecret);
    
    console.log(`📋 Contratos no OMIE: ${contratosOmie.length}`);
    if (contratosOmie.length > 0) {
      console.log(`📋 Números de contrato no OMIE:`, contratosOmie.map((c: any) => c.cabecalho?.cNumCtr));
    }
    
    let contratosAtualizados = 0;

    // Sincronizar contratos
    for (const contrato of contratosCliente || []) {
      if (!contrato.numero_contrato) {
        console.log(`⚠️ Contrato ${contrato.id} sem número, pulando`);
        continue;
      }

      console.log(`🔍 Buscando match para contrato local: ${contrato.numero_contrato}`);

      const contratoOmie = contratosOmie.find((co: any) => 
        co.cabecalho?.cNumCtr && String(co.cabecalho.cNumCtr).trim() === String(contrato.numero_contrato).trim()
      );

      if (contratoOmie?.cabecalho) {
        console.log(`✅ Match encontrado! Contrato OMIE: ${contratoOmie.cabecalho.cNumCtr}`);
        const updateData: any = {
          omie_codigo_cliente: codigoOmie,
          omie_codigo_contrato: String(contratoOmie.cabecalho.nCodCtr),
          omie_data_sincronizacao: new Date().toISOString()
        };

        if (contratoOmie.cabecalho.dVigInicial) {
          const dataInicio = converterDataOmie(contratoOmie.cabecalho.dVigInicial);
          if (dataInicio) {
            updateData.data_inicio = dataInicio;
            console.log(`📅 Data início OMIE: ${contratoOmie.cabecalho.dVigInicial} → ${dataInicio}`);
          }
        }
        if (contratoOmie.cabecalho.dVigFinal) {
          const dataFim = converterDataOmie(contratoOmie.cabecalho.dVigFinal);
          if (dataFim) {
            updateData.data_fim = dataFim;
            console.log(`📅 Data fim OMIE: ${contratoOmie.cabecalho.dVigFinal} → ${dataFim}`);
          }
        }

        console.log(`💾 Atualizando contratos_clientes:`, updateData);

        const { error: updateError } = await supabase
          .from('contratos_clientes')
          .update(updateData)
          .eq('id', contrato.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar contrato ${contrato.id}:`, updateError);
        } else {
          console.log(`✅ Contrato ${contrato.numero_contrato} atualizado com sucesso`);
        }

        // Atualizar parametros_faturamento
        const updateParamsData: any = {};
        if (contratoOmie.cabecalho.dVigInicial) {
          const dataInicio = converterDataOmie(contratoOmie.cabecalho.dVigInicial);
          if (dataInicio) updateParamsData.data_inicio_contrato = dataInicio;
        }
        if (contratoOmie.cabecalho.dVigFinal) {
          const dataFim = converterDataOmie(contratoOmie.cabecalho.dVigFinal);
          if (dataFim) updateParamsData.data_termino_contrato = dataFim;
        }

        if (Object.keys(updateParamsData).length > 0) {
          console.log(`💾 Atualizando parametros_faturamento:`, updateParamsData);
          const { error: paramsError } = await supabase
            .from('parametros_faturamento')
            .update(updateParamsData)
            .eq('numero_contrato', contrato.numero_contrato);

          if (paramsError) {
            console.error(`❌ Erro ao atualizar parâmetros:`, paramsError);
          } else {
            console.log(`✅ Parâmetros atualizados para contrato ${contrato.numero_contrato}`);
          }
        }

        contratosAtualizados++;
      } else {
        console.log(`❌ Nenhum match encontrado no OMIE para contrato: ${contrato.numero_contrato}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Cliente ${cliente.nome} sincronizado com sucesso`,
      cliente_nome: cliente.nome,
      contratos_atualizados: contratosAtualizados
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
