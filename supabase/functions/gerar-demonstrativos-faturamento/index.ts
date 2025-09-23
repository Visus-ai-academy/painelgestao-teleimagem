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

    const { periodo } = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    console.log(`🚀 Iniciando geração de demonstrativos para período: ${periodo}`);
    
    // Buscar TODOS os clientes ativos com parâmetros de faturamento
    const { data: clientesCompletos, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia, 
        nome_mobilemed,
        parametros_faturamento!inner(tipo_faturamento, status)
      `)
      .eq('parametros_faturamento.status', 'A');

    if (clientesError) {
      console.error('❌ Erro ao buscar clientes:', clientesError);
      throw clientesError;
    }

    console.log(`📊 Total de clientes encontrados: ${clientesCompletos?.length || 0}`);
    console.log(`📊 Processando em lotes de 10 clientes`);

    let totalExamesGeral = 0;
    let valorBrutoGeral = 0;
    let valorImpostosGeral = 0;
    let valorTotalGeral = 0;
    let valorExamesGeral = 0;
    let valorFranquiasGeral = 0;
    let valorPortalGeral = 0;
    let valorIntegracaoGeral = 0;
    let clientesSimples = 0;
    let clientesRegimeNormal = 0;
    const resultados = [];

    // Processar em lotes de 10 clientes
    const TAMANHO_LOTE = 10;
    const totalClientes = clientesCompletos?.length || 0;
    
    for (let i = 0; i < totalClientes; i += TAMANHO_LOTE) {
      const loteAtual = clientesCompletos!.slice(i, i + TAMANHO_LOTE);
      console.log(`🔄 Processando lote ${Math.floor(i/TAMANHO_LOTE) + 1}/${Math.ceil(totalClientes/TAMANHO_LOTE)} (${loteAtual.length} clientes)`);

      for (const cliente of loteAtual) {
      const nomeCliente = cliente.nome_fantasia || cliente.nome_mobilemed || cliente.nome;
      
      // Buscar volumetria para este cliente
      console.log(`🔍 Buscando volumetria para cliente: ${nomeCliente} no período ${periodo}`);
      
      const { data: volumetriaCliente } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .or(`"Cliente_Nome_Fantasia".eq.${nomeCliente},"EMPRESA".eq.${nomeCliente}`)
        .eq('periodo_referencia', periodo);

      if (!volumetriaCliente || volumetriaCliente.length === 0) {
        console.log(`📊 Cliente ${nomeCliente}: Sem registros na volumetria para período ${periodo}`);
        continue;
      }

      console.log(`📊 Cliente ${nomeCliente}: ${volumetriaCliente.length} registros encontrados na volumetria para período ${periodo}`);

      // Buscar condição de volume para este cliente
      const { data: contrato } = await supabase
        .from('contratos_clientes')
        .select('cond_volume')
        .eq('cliente_id', cliente.id)
        .eq('status', 'ativo')
        .single();

      const condicaoVolume = contrato?.cond_volume || 'MOD/ESP/CAT';
      console.log(`📋 Condição de Volume para ${nomeCliente}: ${condicaoVolume}`);

      console.log(`📈 Cliente ${nomeCliente}: ${volumetriaCliente.length} registros, ${volumetriaCliente.reduce((sum, r) => sum + (r.VALORES || 0), 0)} exames total`);

      // Agrupar e processar por modalidade/especialidade/categoria/prioridade
      const grupos = {};
      volumetriaCliente.forEach(registro => {
        const key = `${registro.MODALIDADE}/${registro.ESPECIALIDADE}/${registro.CATEGORIA}/${registro.PRIORIDADE}`;
        if (!grupos[key]) {
          grupos[key] = [];
        }
        grupos[key].push(registro);
      });

      console.log(`💰 Calculando preços para ${Object.keys(grupos).length} grupos de exames do cliente ${nomeCliente}`);

      const detalhesCliente = [];
      let valorTotalCliente = 0;

      for (const [key, registros] of Object.entries(grupos)) {
        const [modalidade, especialidade, categoria, prioridade] = key.split('/');
        const quantidade = (registros as any[]).reduce((sum, r) => sum + (r.VALORES || 0), 0);

        if (quantidade === 0) continue;

        console.log(`🔍 Buscando preço para ${nomeCliente}: ${modalidade}/${especialidade}/${categoria}/${prioridade} (${quantidade} exames)`);

        // Usar a função RPC para calcular preço
        const { data: precoData, error: precoError } = await supabase.rpc('calcular_preco_exame', {
          p_cliente: nomeCliente,
          p_modalidade: modalidade,
          p_especialidade: especialidade,
          p_categoria: categoria,
          p_prioridade: prioridade,
          p_periodo: periodo
        });

        if (precoError) {
          console.error(`❌ Erro ao calcular preço para ${nomeCliente}:`, precoError);
          continue;
        }

        if (precoData && precoData > 0) {
          const valorTotal = precoData * quantidade;
          valorTotalCliente += valorTotal;
          
          console.log(`💰 Preço encontrado: ${modalidade}/${especialidade}/${categoria}/${prioridade} = R$ ${precoData.toFixed(2)} x ${quantidade} = R$ ${valorTotal.toFixed(2)}`);
          
          detalhesCliente.push({
            modalidade,
            especialidade, 
            categoria,
            prioridade,
            quantidade,
            valor_unitario: precoData,
            valor_total: valorTotal
          });
        }
      }

      if (detalhesCliente.length > 0) {
        // Buscar parâmetros de faturamento
        const { data: parametros } = await supabase
          .from('parametros_faturamento')
          .select('*')
          .eq('cliente_id', cliente.id)
          .eq('status', 'A')
          .single();

        console.log(`💰 Calculando faturamento para ${nomeCliente} - Volume: ${volumetriaCliente.reduce((sum, r) => sum + (r.VALORES || 0), 0)}`);

        const temParametros = !!parametros;
        const aplicarFranquia = parametros?.aplicar_franquia || false;
        const valorFranquia = parametros?.valor_franquia || 0;
        const portalLaudos = parametros?.portal_laudos || false;
        const cobrarIntegracao = parametros?.cobrar_integracao || false;
        const simples = parametros?.simples || false;
        const percentualIss = parametros?.percentual_iss || 0;

        let valorFranquiaFinal = aplicarFranquia ? valorFranquia : 0;
        let valorPortalFinal = portalLaudos ? (parametros?.valor_integracao || 0) : 0;
        let valorIntegracaoFinal = cobrarIntegracao ? (parametros?.valor_integracao || 0) : 0;

        const valorBruto = valorTotalCliente + valorFranquiaFinal + valorPortalFinal + valorIntegracaoFinal;

        // Cálculo de impostos
        let impostosFederais = 0;
        let impostosMunicipais = 0;
        
        if (simples) {
          clientesSimples++;
        } else {
          clientesRegimeNormal++;
          impostosFederais = valorBruto * 0.0615; // 6.15% federais
        }
        
        if (percentualIss > 0) {
          impostosMunicipais = valorBruto * (percentualIss / 100);
        }

        const totalImpostos = impostosFederais + impostosMunicipais;
        const valorLiquido = valorBruto - totalImpostos;

        // Somar aos totais gerais
        totalExamesGeral += volumetriaCliente.reduce((sum, r) => sum + (r.VALORES || 0), 0);
        valorBrutoGeral += valorBruto;
        valorImpostosGeral += totalImpostos;
        valorTotalGeral += valorLiquido;
        valorExamesGeral += valorTotalCliente;
        valorFranquiasGeral += valorFranquiaFinal;
        valorPortalGeral += valorPortalFinal;
        valorIntegracaoGeral += valorIntegracaoFinal;

        resultados.push({
          cliente: nomeCliente,
          valor_exames: valorTotalCliente,
          valor_franquia: valorFranquiaFinal,
          valor_portal: valorPortalFinal,
          valor_integracao: valorIntegracaoFinal,
          valor_bruto: valorBruto,
          impostos_federais: impostosFederais,
          impostos_municipais: impostosMunicipais,
          total_impostos: totalImpostos,
          valor_liquido: valorLiquido,
          quantidade_exames: volumetriaCliente.reduce((sum, r) => sum + (r.VALORES || 0), 0),
          detalhes: detalhesCliente,
          regime_tributario: simples ? 'Simples Nacional' : 'Regime Normal'
        });

        console.log(`Cliente ${nomeCliente} processado com sucesso - Total: R$ ${valorLiquido.toFixed(2)} (${volumetriaCliente.reduce((sum, r) => sum + (r.VALORES || 0), 0)} exames)`);
      }
    }
    } // Fim do loop de lotes

    const resumo = {
      total_clientes: clientesCompletos?.length || 0,
      clientes_processados: resultados.length,
      total_exames_geral: totalExamesGeral,
      valor_bruto_geral: valorBrutoGeral,
      valor_impostos_geral: valorImpostosGeral,
      valor_total_geral: valorTotalGeral,
      valor_exames_geral: valorExamesGeral,
      valor_franquias_geral: valorFranquiasGeral,
      valor_portal_geral: valorPortalGeral,
      valor_integracao_geral: valorIntegracaoGeral,
      clientes_simples_nacional: clientesSimples,
      clientes_regime_normal: clientesRegimeNormal
    };

    console.log('✅ Resumo final:', JSON.stringify(resumo, null, 2));
    console.log('🎉 Processamento completo de demonstrativos finalizado com sucesso!');

    // Retornar resposta com dados reais
    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        status: 'concluido',
        mensagem: `Demonstrativos gerados com sucesso! ${resultados.length} clientes processados em lotes de 10.`,
        demonstrativos: resultados,
        resumo: resumo,
        alertas: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});