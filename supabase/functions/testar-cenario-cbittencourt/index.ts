import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cliente = 'C.BITTENCOURT';
    const periodo = 'jan/25'; // Período de exemplo

    // Cenários de teste
    const cenarios = [
      {
        nome: 'RX/Medicina Interna/SC/Urgente',
        modalidade: 'RX',
        especialidade: 'Medicina Interna', 
        categoria: 'SC',
        prioridade: 'Urgente',
        quantidade: 75
      },
      {
        nome: 'RX/Medicina Interna/SC/Rotina',
        modalidade: 'RX',
        especialidade: 'Medicina Interna',
        categoria: 'SC', 
        prioridade: 'Rotina',
        quantidade: 150
      },
      {
        nome: 'RX/Medicina Interna/OIT/Rotina',
        modalidade: 'RX',
        especialidade: 'Medicina Interna',
        categoria: 'OIT',
        prioridade: 'Rotina', 
        quantidade: 25
      },
      {
        nome: 'RX/Medicina Interna/OIT/Urgente',
        modalidade: 'RX',
        especialidade: 'Medicina Interna',
        categoria: 'OIT',
        prioridade: 'Urgente',
        quantidade: 125
      }
    ];

    // Buscar cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, nome_mobilemed')
      .or(`nome.ilike.%${cliente}%,nome_fantasia.ilike.%${cliente}%,nome_mobilemed.ilike.%${cliente}%`)
      .limit(1);

    if (clienteError || !clienteData || clienteData.length === 0) {
      console.log('Cliente não encontrado:', cliente);
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: 'Cliente não encontrado',
          cliente_pesquisado: cliente
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    const clienteInfo = clienteData[0];
    console.log('Cliente encontrado:', clienteInfo);

    // Buscar todos os preços do cliente
    const { data: precos, error: precosError } = await supabase
      .from('precos_servicos')
      .select('*')
      .eq('cliente_id', clienteInfo.id);

    if (precosError) {
      console.error('Erro ao buscar preços:', precosError);
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Erro ao buscar preços' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Preços encontrados: ${precos?.length || 0}`);

    const resultados = [];

    // Testar cada cenário
    for (const cenario of cenarios) {
      console.log(`\nTestando cenário: ${cenario.nome}`);
      
      // Buscar preço específico para este cenário
      const precoEspecifico = precos?.find(p => 
        p.modalidade?.trim().toLowerCase() === cenario.modalidade.toLowerCase() &&
        p.especialidade?.trim().toLowerCase() === cenario.especialidade.toLowerCase() &&
        (p.categoria?.trim().toLowerCase() === cenario.categoria.toLowerCase() || !p.categoria) &&
        (p.prioridade?.trim().toLowerCase() === cenario.prioridade.toLowerCase() || !p.prioridade)
      );

      if (!precoEspecifico) {
        console.log('Preço não encontrado para:', cenario.nome);
        resultados.push({
          cenario: cenario.nome,
          quantidade: cenario.quantidade,
          preco_encontrado: false,
          preco_unitario: 0,
          preco_total: 0,
          detalhes: 'Preço não configurado para este cenário'
        });
        continue;
      }

      console.log('Preço encontrado:', {
        valor_base: precoEspecifico.valor_base,
        valor_urgencia: precoEspecifico.valor_urgencia,
        cond_volume: precoEspecifico.cond_volume,
        vol_inicial: precoEspecifico.vol_inicial,
        vol_final: precoEspecifico.vol_final
      });

      // Calcular volume total baseado na condição de volume
      let volumeTotal = 1;
      const condVolume = precoEspecifico.cond_volume || '';

      if (condVolume === 'Mod') {
        // Somar todos RX do cliente
        volumeTotal = 75 + 150 + 25 + 125; // 375 total
      } else if (condVolume === 'Mod/Esp') {
        // Somar todos RX + Medicina Interna do cliente  
        volumeTotal = 75 + 150 + 25 + 125; // 375 total
      } else if (condVolume === 'Mod/Esp/Cat') {
        // Somar por categoria específica
        if (cenario.categoria === 'SC') {
          volumeTotal = 75 + 150; // 225 total SC
        } else if (cenario.categoria === 'OIT') {
          volumeTotal = 25 + 125; // 150 total OIT
        }
      } else if (condVolume === 'Total') {
        // Somar todos os exames do cliente (assumindo só RX neste exemplo)
        volumeTotal = 75 + 150 + 25 + 125; // 375 total
      } else {
        // Sem condição de volume - usar quantidade específica
        volumeTotal = cenario.quantidade;
      }

      console.log('Volume calculado:', volumeTotal, 'Condição:', condVolume);

      // Verificar se volume está na faixa
      const volInicial = precoEspecifico.vol_inicial || 1;
      const volFinal = precoEspecifico.vol_final || 999999;
      
      let precoUnitario = 0;
      if (volumeTotal >= volInicial && volumeTotal <= volFinal) {
        if (cenario.prioridade === 'Urgente' && precoEspecifico.valor_urgencia) {
          precoUnitario = precoEspecifico.valor_urgencia;
        } else {
          precoUnitario = precoEspecifico.valor_base || 0;
        }
      }

      const precoTotal = precoUnitario * cenario.quantidade;

      console.log('Preço unitário:', precoUnitario, 'Preço total:', precoTotal);

      resultados.push({
        cenario: cenario.nome,
        quantidade: cenario.quantidade,
        preco_encontrado: true,
        preco_unitario: precoUnitario,
        preco_total: precoTotal,
        volume_calculado: volumeTotal,
        condicao_volume: condVolume || 'Sem condição',
        faixa_volume: `${volInicial} - ${volFinal}`,
        valor_base: precoEspecifico.valor_base,
        valor_urgencia: precoEspecifico.valor_urgencia,
        detalhes: `Volume ${volumeTotal} está ${volumeTotal >= volInicial && volumeTotal <= volFinal ? 'dentro' : 'fora'} da faixa ${volInicial}-${volFinal}`
      });
    }

    const resumo = {
      cliente: {
        nome: clienteInfo.nome,
        nome_fantasia: clienteInfo.nome_fantasia,
        nome_mobilemed: clienteInfo.nome_mobilemed
      },
      total_precos_configurados: precos?.length || 0,
      periodo_teste: periodo,
      cenarios_testados: resultados.length,
      valor_total_geral: resultados.reduce((sum, r) => sum + r.preco_total, 0)
    };

    return new Response(
      JSON.stringify({
        sucesso: true,
        resumo,
        resultados,
        precos_configurados: precos
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        stack: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});