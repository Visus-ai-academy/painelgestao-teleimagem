const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DemonstrativoCliente {
  cliente_id?: string;
  cliente_nome: string;
  total_exames: number;
  total_registros: number;
  volume_referencia: number;
  condicao_volume: string;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto_total: number;
  percentual_iss: number;
  valor_iss: number;
  impostos_ab_min: number;
  valor_impostos_federais: number;
  valor_total_impostos: number;
  valor_liquido: number;
  valor_total_faturamento: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  parametros_utilizados: any;
}

interface Resumo {
  total_clientes: number;
  clientes_processados: number;
  total_exames_geral: number;
  valor_bruto_geral: number;
  valor_impostos_geral: number;
  valor_total_geral: number;
  valor_exames_geral: number;
  valor_franquias_geral: number;
  valor_portal_geral: number;
  valor_integracao_geral: number;
  clientes_simples_nacional: number;
  clientes_regime_normal: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { periodo, forcar_recalculo = false } = await req.json();
    
    if (!periodo) {
      return new Response(
        JSON.stringify({ error: 'Período é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Iniciando processamento de demonstrativos para período ${periodo} (forçar recálculo: ${forcar_recalculo})`);

    // Verificar se já existem demonstrativos calculados
    if (!forcar_recalculo) {
      const { data: demonstrativosExistentes, error: errorExistentes } = await supabase
        .from('demonstrativos_faturamento_calculados')
        .select('*')
        .eq('periodo_referencia', periodo)
        .eq('status', 'calculado');

      if (!errorExistentes && demonstrativosExistentes && demonstrativosExistentes.length > 0) {
        console.log(`📋 Encontrados ${demonstrativosExistentes.length} demonstrativos já calculados para ${periodo}`);
        
        // Calcular resumo dos dados existentes
        const resumo: Resumo = {
          total_clientes: demonstrativosExistentes.length,
          clientes_processados: demonstrativosExistentes.length,
          total_exames_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.total_exames || 0), 0),
          valor_bruto_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_bruto_total || 0), 0),
          valor_impostos_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_total_impostos || 0), 0),
          valor_total_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_total_faturamento || 0), 0),
          valor_exames_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_exames || 0), 0),
          valor_franquias_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_franquia || 0), 0),
          valor_portal_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_portal_laudos || 0), 0),
          valor_integracao_geral: demonstrativosExistentes.reduce((sum, d) => sum + (d.valor_integracao || 0), 0),
          clientes_simples_nacional: 0,
          clientes_regime_normal: demonstrativosExistentes.length
        };

        return new Response(
          JSON.stringify({
            success: true,
            demonstrativos: demonstrativosExistentes,
            resumo,
            fonte_dados: 'cache_calculado',
            calculado_em: demonstrativosExistentes[0]?.calculado_em
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se chegou até aqui, precisa calcular os demonstrativos
    console.log(`⚡ Calculando demonstrativos para período ${periodo}${forcar_recalculo ? ' (FORÇANDO RECÁLCULO)' : ''}`);

    // Limpar demonstrativos existentes se forçando recálculo
    if (forcar_recalculo) {
      console.log(`🧹 Limpando demonstrativos existentes para período ${periodo}`);
      await supabase
        .from('demonstrativos_faturamento_calculados')
        .delete()
        .eq('periodo_referencia', periodo);
    }

    // Buscar clientes ativos
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id, nome, nome_fantasia, nome_mobilemed, ativo, status,
        contratos_clientes!inner (
          id, status, tipo_faturamento, cond_volume, 
          percentual_iss, impostos_ab_min, simples
        ),
        parametros_faturamento (
          aplicar_franquia, valor_franquia, volume_franquia,
          frequencia_continua, frequencia_por_volume, valor_acima_franquia,
          valor_integracao, portal_laudos, cobrar_integracao, status
        )
      `)
      .eq('ativo', true)
      .eq('contratos_clientes.status', 'ativo');

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    const demonstrativos: DemonstrativoCliente[] = [];
    let resumo: Resumo = {
      total_clientes: clientes?.length || 0,
      clientes_processados: 0,
      total_exames_geral: 0,
      valor_bruto_geral: 0,
      valor_impostos_geral: 0,
      valor_total_geral: 0,
      valor_exames_geral: 0,
      valor_franquias_geral: 0,
      valor_portal_geral: 0,
      valor_integracao_geral: 0,
      clientes_simples_nacional: 0,
      clientes_regime_normal: 0
    };

    // Processar clientes em lotes de 10
    const batchSize = 10;
    for (let i = 0; i < (clientes?.length || 0); i += batchSize) {
      const batch = clientes?.slice(i, i + batchSize) || [];
      console.log(`🔄 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil((clientes?.length || 0)/batchSize)} (${batch.length} clientes)`);

      for (const cliente of batch) {
        try {
          const nomeCliente = cliente.nome_mobilemed || cliente.nome_fantasia || cliente.nome;
          console.log(`🔍 Buscando volumetria para cliente: ${nomeCliente} no período ${periodo}`);

          // Buscar dados de volumetria
          const { data: volumetriaData, error: volumetriaError } = await supabase
            .from('volumetria_mobilemed')
            .select('*')
            .eq('periodo_referencia', periodo)
            .or(`EMPRESA.eq.${nomeCliente},EMPRESA.eq.${cliente.nome_fantasia || ''},EMPRESA.eq.${cliente.nome}`)
            .not('arquivo_fonte', 'eq', 'volumetria_onco_padrao');

          if (volumetriaError || !volumetriaData || volumetriaData.length === 0) {
            console.log(`📊 Cliente ${nomeCliente}: Sem registros na volumetria para período ${periodo}`);
            continue;
          }

          console.log(`📊 Cliente ${nomeCliente}: ${volumetriaData.length} registros encontrados na volumetria para período ${periodo}`);

          const totalExames = volumetriaData.reduce((sum, item) => sum + (item.VALORES || 0), 0);
          const totalRegistros = volumetriaData.length;

          console.log(`📈 Cliente ${nomeCliente}: ${totalRegistros} registros, ${totalExames} exames total`);

          const contrato = cliente.contratos_clientes[0];
          const condicaoVolume = contrato?.cond_volume || 'MOD/ESP/CAT';
          console.log(`📋 Condição de Volume para ${nomeCliente}: ${condicaoVolume}`);

          // Agrupar dados por modalidade, especialidade, categoria, prioridade
          const gruposExames = new Map();
          let volumeRef = 0;

          for (const item of volumetriaData) {
            let chaveAgrupamento = '';
            switch (condicaoVolume) {
              case 'MOD':
                chaveAgrupamento = `${item.MODALIDADE}`;
                break;
              case 'MOD/ESP':
                chaveAgrupamento = `${item.MODALIDADE}/${item.ESPECIALIDADE}`;
                break;
              case 'MOD/ESP/CAT':
                chaveAgrupamento = `${item.MODALIDADE}/${item.ESPECIALIDADE}/${item.CATEGORIA}`;
                break;
              case 'GERAL':
              default:
                chaveAgrupamento = 'GERAL';
                break;
            }

            const chaveCompleta = `${chaveAgrupamento}/${item.PRIORIDADE}`;

            if (!gruposExames.has(chaveCompleta)) {
              gruposExames.set(chaveCompleta, {
                modalidade: item.MODALIDADE,
                especialidade: item.ESPECIALIDADE,
                categoria: item.CATEGORIA,
                prioridade: item.PRIORIDADE,
                quantidade: 0,
                volumeRef: 0
              });
            }

            const grupo = gruposExames.get(chaveCompleta);
            grupo.quantidade += (item.VALORES || 0);
            
            // Calcular volume de referência baseado na condição
            if (condicaoVolume === 'GERAL') {
              volumeRef = totalExames;
            } else {
              // Somar por grupo específico
              grupo.volumeRef += (item.VALORES || 0);
            }
          }

          console.log(`💰 Calculando preços para ${gruposExames.size} grupos de exames do cliente ${nomeCliente}`);

          // Calcular preços para cada grupo usando RPC
          let valorExamesTotal = 0;
          const detalhesExames: any[] = [];

          for (const [chave, grupo] of gruposExames) {
            const volRef = condicaoVolume === 'GERAL' ? totalExames : grupo.volumeRef;
            console.log(`🔍 Buscando preço para ${nomeCliente}: ${chave} (qtd=${grupo.quantidade}, volRef=${volRef})`);

            const { data: precoData, error: precoError } = await supabase.rpc('calcular_preco_exame', {
              p_cliente_nome: nomeCliente,
              p_modalidade: grupo.modalidade,
              p_especialidade: grupo.especialidade, 
              p_categoria: grupo.categoria,
              p_prioridade: grupo.prioridade,
              p_volume_referencia: volRef
            });

            if (precoError) {
              console.error(`❌ Erro no cálculo de preço para ${nomeCliente} - ${chave}:`, precoError);
            }

            let valorUnitario = 0;
            if (precoData) {
              if (typeof precoData === 'number') {
                valorUnitario = precoData;
              } else if (Array.isArray(precoData) && precoData.length > 0) {
                valorUnitario = precoData[0].valor || 0;
              } else if (typeof precoData === 'object' && precoData.valor) {
                valorUnitario = precoData.valor;
              }
            }

            const valorGrupo = grupo.quantidade * valorUnitario;
            valorExamesTotal += valorGrupo;

            detalhesExames.push({
              modalidade: grupo.modalidade,
              especialidade: grupo.especialidade,
              categoria: grupo.categoria,
              prioridade: grupo.prioridade,
              quantidade: grupo.quantidade,
              valor_unitario: valorUnitario,
              valor_total: valorGrupo,
              volume_referencia: volRef
            });
          }

          // Buscar parâmetros de faturamento
          const parametrosFaturamento = cliente.parametros_faturamento?.find(p => p.status === 'A') || {};

          // Calcular franquia, portal e integração usando RPC existente
          console.log(`💰 Calculando faturamento completo para ${nomeCliente}...`);
          const { data: calculoCompleto, error: calculoError } = await supabase.rpc('calcular_faturamento_completo', {
            p_cliente_id: cliente.id,
            p_periodo: periodo,
            p_volume_total: totalExames
          });

          if (calculoError) {
            console.error(`❌ Erro no cálculo de faturamento para ${nomeCliente}:`, calculoError);
          }

          const franquia = calculoCompleto?.[0] || {};
          console.log(`📊 Resultado cálculo faturamento ${nomeCliente}:`, franquia);

          // Calcular impostos
          const valorBrutoTotal = valorExamesTotal + (franquia.valor_franquia || 0) + (franquia.valor_portal_laudos || 0) + (franquia.valor_integracao || 0);
          const percentualISS = contrato?.percentual_iss || 0;
          const impostosAbMin = contrato?.impostos_ab_min || 0;
          const ehSimplesNacional = contrato?.simples || false;

          const valorISS = valorBrutoTotal * (percentualISS / 100);
          const valorImpostosFederais = ehSimplesNacional ? 0 : impostosAbMin;
          const valorTotalImpostos = valorISS + valorImpostosFederais;
          const valorLiquido = valorBrutoTotal - valorTotalImpostos;

          const demonstrativo: DemonstrativoCliente = {
            cliente_id: cliente.id,
            cliente_nome: nomeCliente,
            total_exames: totalExames,
            total_registros: totalRegistros,
            volume_referencia: totalExames,
            condicao_volume: condicaoVolume,
            valor_exames: valorExamesTotal,
            valor_franquia: franquia.valor_franquia || 0,
            valor_portal_laudos: franquia.valor_portal_laudos || 0,
            valor_integracao: franquia.valor_integracao || 0,
            valor_bruto_total: valorBrutoTotal,
            percentual_iss: percentualISS,
            valor_iss: valorISS,
            impostos_ab_min: impostosAbMin,
            valor_impostos_federais: valorImpostosFederais,
            valor_total_impostos: valorTotalImpostos,
            valor_liquido: valorLiquido,
            valor_total_faturamento: valorBrutoTotal,
            detalhes_franquia: franquia.detalhes_franquia || {},
            detalhes_exames: detalhesExames,
            parametros_utilizados: {
              contrato: contrato,
              parametros_faturamento: parametrosFaturamento,
              eh_simples_nacional: ehSimplesNacional
            }
          };

          // Salvar na tabela de demonstrativos calculados
          const { error: insertError } = await supabase
            .from('demonstrativos_faturamento_calculados')
            .insert({
              periodo_referencia: periodo,
              cliente_id: cliente.id,
              cliente_nome: nomeCliente,
              total_exames: totalExames,
              total_registros: totalRegistros,
              volume_referencia: totalExames,
              condicao_volume: condicaoVolume,
              valor_exames: valorExamesTotal,
              valor_franquia: franquia.valor_franquia || 0,
              valor_portal_laudos: franquia.valor_portal_laudos || 0,
              valor_integracao: franquia.valor_integracao || 0,
              valor_bruto_total: valorBrutoTotal,
              percentual_iss: percentualISS,
              valor_iss: valorISS,
              impostos_ab_min: impostosAbMin,
              valor_impostos_federais: valorImpostosFederais,
              valor_total_impostos: valorTotalImpostos,
              valor_liquido: valorLiquido,
              valor_total_faturamento: valorBrutoTotal,
              detalhes_franquia: franquia.detalhes_franquia || {},
              detalhes_exames: detalhesExames,
              parametros_utilizados: demonstrativo.parametros_utilizados,
              status: 'calculado'
            });

          if (insertError) {
            console.error(`❌ Erro ao salvar demonstrativo para ${nomeCliente}:`, insertError);
            throw new Error(`Erro ao salvar demonstrativo: ${insertError.message}`);
          }

          console.log(`✅ Demonstrativo salvo com sucesso para ${nomeCliente}`);

          demonstrativos.push(demonstrativo);

          // Atualizar resumo
          resumo.clientes_processados++;
          resumo.total_exames_geral += totalExames;
          resumo.valor_bruto_geral += valorBrutoTotal;
          resumo.valor_impostos_geral += valorTotalImpostos;
          resumo.valor_total_geral += valorBrutoTotal;
          resumo.valor_exames_geral += valorExamesTotal;
          resumo.valor_franquias_geral += (franquia.valor_franquia || 0);
          resumo.valor_portal_geral += (franquia.valor_portal_laudos || 0);
          resumo.valor_integracao_geral += (franquia.valor_integracao || 0);

          if (ehSimplesNacional) {
            resumo.clientes_simples_nacional++;
          } else {
            resumo.clientes_regime_normal++;
          }

        } catch (error) {
          console.error(`❌ Erro ao processar cliente ${cliente.nome}:`, error);
          
          // Salvar erro na tabela
          await supabase
            .from('demonstrativos_faturamento_calculados')
            .insert({
              periodo_referencia: periodo,
              cliente_id: cliente.id,
              cliente_nome: cliente.nome,
              status: 'erro',
              erro_detalhes: error instanceof Error ? error.message : String(error)
            });
        }
      }
    }

    console.log(`✅ Resumo final:`, JSON.stringify(resumo, null, 2));
    console.log('🎉 Processamento completo de demonstrativos finalizado com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        demonstrativos, 
        resumo,
        fonte_dados: 'recalculado',
        calculado_em: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});