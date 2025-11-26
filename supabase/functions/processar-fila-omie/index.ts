import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieContrato {
  cabecalho?: {
    nCodCtr: number;
    cNumCtr: string;
    dVigInicial: string;
    dVigFinal: string;
  };
}

function converterDataOmie(dataOmie: string): string | null {
  if (!dataOmie) return null;
  const partes = dataOmie.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 425 || response.status === 429 || response.status === 500) {
        const waitTime = Math.pow(2, attempt) * 3000;
        console.log(`Erro ${response.status}. Aguardando ${waitTime}ms (tentativa ${attempt + 1}/${maxRetries})...`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, attempt) * 2000;
      console.log(`Erro na requisição. Aguardando ${waitTime}ms (tentativa ${attempt + 1}/${maxRetries})...`);
      await delay(waitTime);
    }
  }
  
  throw new Error('Máximo de tentativas excedido');
}

async function buscarClienteOmie(cnpj: string, nomeCliente: string) {
  const omieAppKey = Deno.env.get('OMIE_APP_KEY');
  const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

  if (!omieAppKey || !omieAppSecret) {
    throw new Error('Credenciais do OMIE não configuradas');
  }

  const digits = (cnpj || '').replace(/\D/g, '');
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const alvoNome = norm(nomeCliente);

  for (let pagina = 1; pagina <= 50; pagina++) {
    const response = await fetchWithRetry('https://app.omie.com.br/api/v1/geral/clientes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: "ListarClientes",
        app_key: omieAppKey,
        app_secret: omieAppSecret,
        param: [{
          pagina,
          registros_por_pagina: 100,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status}`);
    }

    await delay(3000);

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

async function buscarContratosOmie(codigoClienteOmie: string): Promise<OmieContrato[]> {
  const omieAppKey = Deno.env.get('OMIE_APP_KEY');
  const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

  if (!omieAppKey || !omieAppSecret) {
    throw new Error('Credenciais do OMIE não configuradas');
  }

  const contratos: OmieContrato[] = [];

  for (let pagina = 1; pagina <= 20; pagina++) {
    const response = await fetchWithRetry('https://app.omie.com.br/api/v1/servicos/contrato/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: "ListarContratos",
        app_key: omieAppKey,
        app_secret: omieAppSecret,
        param: [{
          pagina,
          registros_por_pagina: 100,
          apenas_importado_api: 'N',
          filtrar_por_cliente: codigoClienteOmie
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status}`);
    }

    await delay(3000);

    const dados = await response.json();
    const lista = dados.contratoCadastro || [];

    if (lista.length === 0) break;
    contratos.push(...lista);
    if (lista.length < 100) break;
  }

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

    // Buscar próximo cliente pendente na fila
    const { data: clientePendente, error: fetchError } = await supabase
      .from('fila_sincronizacao_omie')
      .select('*')
      .eq('status', 'pendente')
      .lt('tentativas', supabase.rpc('max_tentativas'))
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !clientePendente) {
      console.log('Nenhum cliente pendente na fila');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum cliente pendente para processar'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Marcar como processando
    await supabase
      .from('fila_sincronizacao_omie')
      .update({ 
        status: 'processando',
        iniciado_em: new Date().toISOString(),
        tentativas: clientePendente.tentativas + 1
      })
      .eq('id', clientePendente.id);

    console.log(`Processando cliente: ${clientePendente.cliente_nome}`);

    try {
      let codigoOmie = clientePendente.omie_codigo_cliente;

      // Buscar código OMIE se não existir
      if (!codigoOmie) {
        if (!clientePendente.cnpj) {
          throw new Error('Cliente sem CNPJ');
        }

        const encontrado = await buscarClienteOmie(clientePendente.cnpj, clientePendente.cliente_nome);
        
        if (!encontrado?.codigo_omie) {
          await supabase
            .from('fila_sincronizacao_omie')
            .update({ 
              status: 'nao_encontrado',
              erro_mensagem: 'Cliente não encontrado no OMIE',
              concluido_em: new Date().toISOString()
            })
            .eq('id', clientePendente.id);

          return new Response(JSON.stringify({
            success: true,
            message: `Cliente ${clientePendente.cliente_nome} não encontrado no OMIE`
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        codigoOmie = String(encontrado.codigo_omie);

        // Atualizar código OMIE no cliente
        await supabase
          .from('clientes')
          .update({ 
            omie_codigo_cliente: codigoOmie,
            omie_data_sincronizacao: new Date().toISOString()
          })
          .eq('id', clientePendente.cliente_id);

        // Atualizar fila
        await supabase
          .from('fila_sincronizacao_omie')
          .update({ omie_codigo_cliente: codigoOmie })
          .eq('id', clientePendente.id);
      }

      // Buscar contratos do cliente
      const { data: contratosCliente } = await supabase
        .from('contratos_clientes')
        .select('id, numero_contrato, data_inicio, data_fim')
        .eq('cliente_id', clientePendente.cliente_id)
        .in('status', ['ativo', 'vencido']);

      // Buscar contratos no OMIE
      const contratosOmie = await buscarContratosOmie(codigoOmie);
      
      let contratosAtualizados = 0;

      // Sincronizar contratos
      for (const contrato of contratosCliente || []) {
        if (!contrato.numero_contrato) continue;

        const contratoOmie = contratosOmie.find((co: OmieContrato) => 
          co.cabecalho?.cNumCtr && String(co.cabecalho.cNumCtr).trim() === String(contrato.numero_contrato).trim()
        );

        if (contratoOmie?.cabecalho) {
          const updateData: any = {
            omie_codigo_cliente: codigoOmie,
            omie_codigo_contrato: String(contratoOmie.cabecalho.nCodCtr),
            omie_data_sincronizacao: new Date().toISOString()
          };

          if (contratoOmie.cabecalho.dVigInicial) {
            const dataInicio = converterDataOmie(contratoOmie.cabecalho.dVigInicial);
            if (dataInicio) updateData.data_inicio = dataInicio;
          }
          if (contratoOmie.cabecalho.dVigFinal) {
            const dataFim = converterDataOmie(contratoOmie.cabecalho.dVigFinal);
            if (dataFim) updateData.data_fim = dataFim;
          }

          await supabase
            .from('contratos_clientes')
            .update(updateData)
            .eq('id', contrato.id);

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
            await supabase
              .from('parametros_faturamento')
              .update(updateParamsData)
              .eq('numero_contrato', contrato.numero_contrato);
          }

          contratosAtualizados++;
        }
      }

      // Marcar como concluído
      await supabase
        .from('fila_sincronizacao_omie')
        .update({ 
          status: 'concluido',
          concluido_em: new Date().toISOString()
        })
        .eq('id', clientePendente.id);

      console.log(`✓ Cliente ${clientePendente.cliente_nome} sincronizado - ${contratosAtualizados} contratos atualizados`);

      return new Response(JSON.stringify({
        success: true,
        message: `Cliente ${clientePendente.cliente_nome} sincronizado com sucesso`,
        contratos_atualizados: contratosAtualizados
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
      const mensagemErro = error?.message || String(error);
      console.error(`Erro ao processar ${clientePendente.cliente_nome}:`, mensagemErro);

      const statusFinal = clientePendente.tentativas >= clientePendente.max_tentativas - 1 ? 'erro' : 'pendente';
      
      await supabase
        .from('fila_sincronizacao_omie')
        .update({ 
          status: statusFinal,
          erro_mensagem: mensagemErro,
          concluido_em: statusFinal === 'erro' ? new Date().toISOString() : null
        })
        .eq('id', clientePendente.id);

      return new Response(JSON.stringify({
        success: false,
        error: mensagemErro,
        cliente: clientePendente.cliente_nome,
        tentativa: clientePendente.tentativas + 1
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Erro na função processar-fila-omie:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
