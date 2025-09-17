import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      throw new Error('Credenciais do Omie não configuradas');
    }

    console.log(`🔍 Debugando problema do contrato COT`);

    // Buscar dados do cliente COT
    const { data: clienteCOT, error: clienteError } = await supabase
      .from('clientes')
      .select(`
        id, nome, cnpj, omie_codigo_cliente,
        contratos_clientes!inner(
          id, numero_contrato, omie_codigo_contrato, status
        )
      `)
      .ilike('nome', '%COT%')
      .eq('contratos_clientes.status', 'ativo')
      .single();

    if (clienteError || !clienteCOT) {
      console.error('Cliente COT não encontrado:', clienteError);
      throw new Error('Cliente COT não encontrado no banco');
    }

    console.log('📋 Dados do cliente COT no Supabase:', JSON.stringify(clienteCOT, null, 2));

    const codigoClienteOmie = clienteCOT.omie_codigo_cliente;
    const codigoClienteNumerico = Number(String(codigoClienteOmie).replace(/\D/g, ''));

    console.log(`Cliente COT - Código OMIE: ${codigoClienteOmie} | Numérico: ${codigoClienteNumerico}`);

    // Listar todos os contratos do cliente no OMIE
    const listarContratosReq = {
      call: 'ListarContratos',
      app_key: omieAppKey,
      app_secret: omieAppSecret,
      param: [{
        pagina: 1,
        registros_por_pagina: 50,
        filtrar_cliente: codigoClienteNumerico
      }]
    };

    console.log('🔍 Consultando contratos no OMIE:', JSON.stringify(listarContratosReq, null, 2));

    const respListar = await fetch("https://app.omie.com.br/api/v1/servicos/contrato/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listarContratosReq)
    });

    const resultListar = await respListar.json();
    console.log('📊 Resultado da consulta de contratos:', JSON.stringify(resultListar, null, 2));

    let contratoEncontrado = null;
    let mensagem = '';

    if (resultListar?.contratos_cadastro && Array.isArray(resultListar.contratos_cadastro)) {
      console.log(`✅ Encontrados ${resultListar.contratos_cadastro.length} contratos para COT`);
      
      // Procurar contrato ativo
      contratoEncontrado = resultListar.contratos_cadastro.find((c: any) => 
        c.cabecalho?.cSituacao === 'ATIVO' || c.cabecalho?.cSituacao === 'A'
      );

      if (!contratoEncontrado && resultListar.contratos_cadastro.length > 0) {
        contratoEncontrado = resultListar.contratos_cadastro[0];
      }

      if (contratoEncontrado) {
        const novoCodigo = contratoEncontrado.cabecalho?.nCodCtr;
        mensagem = `Contrato encontrado: ${contratoEncontrado.cabecalho?.cNumCtr} (Código: ${novoCodigo})`;
        
        // Atualizar no Supabase
        if (novoCodigo && String(novoCodigo) !== String(clienteCOT.contratos_clientes[0].omie_codigo_contrato)) {
          await supabase
            .from('contratos_clientes')
            .update({ 
              omie_codigo_contrato: String(novoCodigo),
              omie_data_sincronizacao: new Date().toISOString()
            })
            .eq('id', clienteCOT.contratos_clientes[0].id);
          
          mensagem += ` | Código atualizado no Supabase: ${novoCodigo}`;
        }
      } else {
        mensagem = 'Nenhum contrato ativo encontrado no OMIE';
      }
    } else if (resultListar?.faultstring) {
      mensagem = `Erro do OMIE: ${resultListar.faultstring}`;
    } else {
      mensagem = 'Resposta inesperada do OMIE';
    }

    // Tentar buscar pelo CNPJ como fallback
    if (!contratoEncontrado && clienteCOT.cnpj) {
      console.log('🔍 Tentando buscar cliente no OMIE via CNPJ...');
      
      const buscaOmieResponse = await supabase.functions.invoke('buscar-codigo-cliente-omie', {
        body: {
          cnpj: String(clienteCOT.cnpj).replace(/\D/g, ''),
          nome_cliente: 'COT'
        }
      });

      if (buscaOmieResponse.data?.sucesso) {
        mensagem += ` | Busca por CNPJ: ${JSON.stringify(buscaOmieResponse.data)}`;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cliente_supabase: clienteCOT,
        contratos_omie: resultListar,
        contrato_encontrado: contratoEncontrado,
        mensagem,
        recomendacao: contratoEncontrado 
          ? 'Contrato encontrado - tente gerar a NF novamente'
          : 'Verificar se o cliente COT possui contrato ativo no OMIE'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na função debug-contrato-cot:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});