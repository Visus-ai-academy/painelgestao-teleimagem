import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OmieApiRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

interface BuscarClienteRequest {
  cnpj?: string;
  nome_cliente?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj, nome_cliente }: BuscarClienteRequest = await req.json();

    if (!cnpj && !nome_cliente) {
      throw new Error('É necessário informar o CNPJ ou o nome do cliente');
    }

    // Obter credenciais do OMIE
    const omieAppKey = Deno.env.get('OMIE_APP_KEY');
    const omieAppSecret = Deno.env.get('OMIE_APP_SECRET');

    if (!omieAppKey || !omieAppSecret) {
      throw new Error('Credenciais do OMIE não configuradas (OMIE_APP_KEY e OMIE_APP_SECRET)');
    }

    console.log(`Buscando cliente no OMIE - CNPJ: ${cnpj || 'N/A'}, Nome: ${nome_cliente || 'N/A'}`);

    // Buscar cliente na API do OMIE com paginação e filtros básicos
    const registrosPorPagina = 500;
    let pagina = 1;
    let totalPaginas = 1;
    let clienteEncontrado: any = null;

    // Normalizar critérios de busca
    const cnpjLimpo = cnpj ? String(cnpj).replace(/[^\d]/g, '') : null;
    const nomeClienteUpper = nome_cliente ? String(nome_cliente).toUpperCase().trim() : null;

    while (pagina <= totalPaginas && !clienteEncontrado) {
      const reqBody: OmieApiRequest = {
        call: "ListarClientes",
        app_key: omieAppKey,
        app_secret: omieAppSecret,
        param: [{
          pagina,
          registros_por_pagina: registrosPorPagina
        }]
      };

      console.log(`Consultando API OMIE - ListarClientes (página ${pagina})...`);

      const omieResponse = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody)
      });

      if (!omieResponse.ok) {
        const errorText = await omieResponse.text();
        throw new Error(`Erro na API OMIE: ${omieResponse.status} - ${errorText}`);
      }

      const omieData = await omieResponse.json();
      const lista = omieData.clientes_cadastro || [];
      console.log(`API OMIE retornou ${lista.length} clientes na página ${pagina}`);

      // Atualizar total de páginas se disponível
      if (typeof omieData.total_de_paginas === 'number' && omieData.total_de_paginas > 0) {
        totalPaginas = omieData.total_de_paginas;
      } else if (lista.length < registrosPorPagina) {
        totalPaginas = pagina; // última página
      } else {
        totalPaginas = pagina + 1; // assume próxima
      }

      // Buscar por CNPJ exato primeiro
      if (cnpjLimpo) {
        clienteEncontrado = lista.find((cliente: any) => {
          const cnpjOmie = cliente.cnpj_cpf?.replace(/[^\d]/g, '') || '';
          return cnpjOmie === cnpjLimpo;
        }) || null;
      }

      // Se não achou por CNPJ, tentar por nome (contains, bidirecional)
      if (!clienteEncontrado && nomeClienteUpper) {
        clienteEncontrado = lista.find((cliente: any) => {
          const razaoSocial = cliente.razao_social?.toUpperCase().trim() || '';
          const nomeFantasia = cliente.nome_fantasia?.toUpperCase().trim() || '';
          return razaoSocial.includes(nomeClienteUpper) || 
                 nomeFantasia.includes(nomeClienteUpper) ||
                 nomeClienteUpper.includes(razaoSocial) ||
                 nomeClienteUpper.includes(nomeFantasia);
        }) || null;
      }

      pagina++;
    }

    // Se nenhuma página trouxe resultados
    if (!clienteEncontrado) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'Cliente não encontrado no OMIE',
        busca_realizada: { cnpj, nome_cliente }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }


    // Cliente encontrado!
    const resultado = {
      sucesso: true,
      cliente_encontrado: {
        codigo_omie: clienteEncontrado.codigo_cliente_omie,
        razao_social: clienteEncontrado.razao_social,
        nome_fantasia: clienteEncontrado.nome_fantasia,
        cnpj: clienteEncontrado.cnpj_cpf,
        email: clienteEncontrado.email,
        cidade: clienteEncontrado.cidade,
        estado: clienteEncontrado.estado
      },
      busca_realizada: { cnpj, nome_cliente }
    };

    console.log(`Cliente encontrado no OMIE: ${clienteEncontrado.razao_social} - Código: ${clienteEncontrado.codigo_cliente_omie}`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na função buscar-codigo-cliente-omie:', error);
    
    return new Response(JSON.stringify({
      sucesso: false,
      erro: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});