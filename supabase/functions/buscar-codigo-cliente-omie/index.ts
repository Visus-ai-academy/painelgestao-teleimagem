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

    // Buscar cliente na API do OMIE
    const buscarClienteReq: OmieApiRequest = {
      call: "ListarClientes",
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina: 1,
        registros_por_pagina: 100
      }]
    };

    console.log('Consultando API OMIE - ListarClientes...');

    const omieResponse = await fetch('https://app.omie.com.br/api/v1/geral/clientes/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buscarClienteReq)
    });

    if (!omieResponse.ok) {
      const errorText = await omieResponse.text();
      throw new Error(`Erro na API OMIE: ${omieResponse.status} - ${errorText}`);
    }

    const omieData = await omieResponse.json();
    console.log(`API OMIE retornou ${omieData.clientes_cadastro?.length || 0} clientes`);

    if (!omieData.clientes_cadastro || omieData.clientes_cadastro.length === 0) {
      return new Response(JSON.stringify({
        sucesso: false,
        erro: 'Nenhum cliente encontrado no OMIE',
        total_clientes: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filtrar cliente por CNPJ ou nome
    let clienteEncontrado = null;

    if (cnpj) {
      // Limpar CNPJ para comparação (remover caracteres especiais)
      const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
      
      clienteEncontrado = omieData.clientes_cadastro.find((cliente: any) => {
        const cnpjOmie = cliente.cnpj_cpf?.replace(/[^\d]/g, '') || '';
        return cnpjOmie === cnpjLimpo;
      });
    }

    // Se não encontrou por CNPJ, tentar por nome
    if (!clienteEncontrado && nome_cliente) {
      const nomeCliente = nome_cliente.toUpperCase().trim();
      
      clienteEncontrado = omieData.clientes_cadastro.find((cliente: any) => {
        const razaoSocial = cliente.razao_social?.toUpperCase().trim() || '';
        const nomeFantasia = cliente.nome_fantasia?.toUpperCase().trim() || '';
        
        return razaoSocial.includes(nomeCliente) || 
               nomeFantasia.includes(nomeCliente) ||
               nomeCliente.includes(razaoSocial) ||
               nomeCliente.includes(nomeFantasia);
      });
    }

    if (!clienteEncontrado) {
      // Listar primeiros 10 clientes para referência
      const clientesReferencia = omieData.clientes_cadastro.slice(0, 10).map((cliente: any) => ({
        codigo: cliente.codigo_cliente_omie,
        razao_social: cliente.razao_social,
        nome_fantasia: cliente.nome_fantasia,
        cnpj: cliente.cnpj_cpf
      }));

      return new Response(JSON.stringify({
        sucesso: false,
        erro: `Cliente não encontrado no OMIE`,
        busca_realizada: { cnpj, nome_cliente },
        total_clientes: omieData.clientes_cadastro.length,
        clientes_referencia: clientesReferencia
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