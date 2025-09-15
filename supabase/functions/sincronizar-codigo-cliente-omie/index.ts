import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  clientes?: string[];      // nomes (case-insensitive)
  cliente_ids?: string[];   // UUIDs
  cnpjs?: string[];         // CNPJs
  apenas_sem_codigo?: boolean; // se true, busca apenas clientes com omie_codigo_cliente NULL
  limite?: number;          // limite de clientes no modo sem filtro
}

interface OmieApiRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

// Função para buscar cliente no OMIE diretamente
async function buscarClienteOmie(cnpj: string, nomeCliente: string) {
  const omieAppKey = Deno.env.get('OMIE_APP_KEY');
  const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

  if (!omieAppKey || !omieAppSecret) {
    throw new Error('Credenciais do OMIE não configuradas');
  }

  console.log(`Buscando cliente no OMIE - CNPJ: ${cnpj}, Nome: ${nomeCliente}`);

  // Paginar resultados e tentar casar por CNPJ (normalizado) e, se necessário, por nome
  const digits = (cnpj || '').replace(/\D/g, '');
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const alvoNome = norm(nomeCliente);

  for (let pagina = 1; pagina <= 50; pagina++) {
    const buscarClienteReq: OmieApiRequest = {
      call: "ListarClientes",
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina,
        registros_por_pagina: 100,
      }],
    };

    console.log(`Consultando API OMIE - ListarClientes (página ${pagina})...`);

    const response = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buscarClienteReq),
    });

    if (!response.ok) {
      throw new Error(`Erro na API do OMIE: ${response.status} - ${response.statusText}`);
    }

    const dados = await response.json();
    const lista = dados.clientes_cadastro || [];
    console.log(`API OMIE retornou ${lista.length} clientes na página ${pagina}`);

    if (lista.length === 0) break; // fim da paginação

    // 1) Tentar por CNPJ (somente dígitos)
    let clienteEncontrado = lista.find((cliente: any) => {
      const cnpjResp = String(cliente.cnpj_cpf || '').replace(/\D/g, '');
      return cnpjResp && digits && cnpjResp === digits;
    });

    // 2) Se não encontrou por CNPJ, tentar por nome (razao_social ou nome_fantasia)
    if (!clienteEncontrado && alvoNome) {
      clienteEncontrado = lista.find((cliente: any) =>
        norm(cliente.razao_social).includes(alvoNome) ||
        norm(cliente.nome_fantasia).includes(alvoNome)
      );
    }

    if (clienteEncontrado) {
      console.log(`Cliente encontrado no OMIE: ${clienteEncontrado.razao_social} - Código: ${clienteEncontrado.codigo_cliente_omie}`);
      return {
        codigo_omie: clienteEncontrado.codigo_cliente_omie,
        razao_social: clienteEncontrado.razao_social,
        nome_fantasia: clienteEncontrado.nome_fantasia,
        cnpj: clienteEncontrado.cnpj_cpf,
      };
    }

    // Se retornou menos que a página cheia, não há próximas páginas
    if (lista.length < 100) break;
  }

  return null;
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

    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clientes, cliente_ids, cnpjs, apenas_sem_codigo = true, limite = 1000 } = body || {};

    console.log('Iniciando sincronização de códigos Omie (cliente) com parâmetros:', body);

    // Montar query base
    let query = supabase
      .from('clientes')
      .select('id, nome, cnpj, omie_codigo_cliente');

    if (cliente_ids && cliente_ids.length > 0) {
      query = query.in('id', cliente_ids);
    } else if (cnpjs && cnpjs.length > 0) {
      query = query.in('cnpj', cnpjs);
    } else if (clientes && clientes.length > 0) {
      // montar OR com ILIKE para nomes
      const orCond = clientes.map((n) => `nome.ilike.%${n}%`).join(',');
      query = query.or(orCond);
    } else if (apenas_sem_codigo) {
      query = query.is('omie_codigo_cliente', null).not('cnpj', 'is', null).limit(limite);
    } else {
      query = query.limit(limite);
    }

    const { data: clientesData, error: listError } = await query;
    if (listError) throw listError;

    if (!clientesData || clientesData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total_encontrados: 0,
        atualizados: 0,
        nao_encontrados: 0,
        resultados: [],
        mensagem: 'Nenhum cliente para sincronizar com os critérios fornecidos.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resultados: Array<any> = [];
    let atualizados = 0;
    let naoEncontrados = 0;
    let erros = 0;

    for (const c of clientesData) {
      try {
        // Se já tem código, pular
        if (c.omie_codigo_cliente) {
          resultados.push({ cliente: c.nome, cnpj: c.cnpj, pulado: true, motivo: 'já possui omie_codigo_cliente' });
          continue;
        }

        if (!c.cnpj) {
          resultados.push({ cliente: c.nome, cnpj: null, sucesso: false, erro: 'Cliente sem CNPJ' });
          naoEncontrados++;
          continue;
        }

        // Buscar no Omie diretamente
        const encontrado = await buscarClienteOmie(c.cnpj, c.nome);
        
        if (!encontrado?.codigo_omie) {
          resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: false, erro: 'Cliente não encontrado no Omie' });
          naoEncontrados++;
          continue;
        }

        const codigoOmie = String(encontrado.codigo_omie);
        const agora = new Date().toISOString();

        // Atualizar cliente
        const { error: updClienteError } = await supabase
          .from('clientes')
          .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
          .eq('id', c.id);

        if (updClienteError) throw updClienteError;

        // Atualizar todos os contratos ativos e vencidos deste cliente
        const { error: updContratosError } = await supabase
          .from('contratos_clientes')
          .update({ omie_codigo_cliente: codigoOmie, omie_data_sincronizacao: agora })
          .eq('cliente_id', c.id)
          .in('status', ['ativo', 'vencido']);

        if (updContratosError) throw updContratosError;

        resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: true, omie_codigo_cliente: codigoOmie });
        atualizados++;
      } catch (e) {
        console.error(`Erro ao sincronizar cliente ${c.nome}:`, e);
        resultados.push({ cliente: c.nome, cnpj: c.cnpj, sucesso: false, erro: String(e?.message || e) });
        erros++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_encontrados: clientesData.length,
      atualizados,
      nao_encontrados: naoEncontrados,
      erros,
      resultados
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Erro na função sincronizar-codigo-cliente-omie:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
