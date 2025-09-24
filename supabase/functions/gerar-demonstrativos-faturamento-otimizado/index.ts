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
    const { data: clientesRaw, error: clientesError } = await supabase
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

    // Agrupar clientes por nome_fantasia
    const clientesAgrupados = new Map();
    for (const cliente of clientesRaw || []) {
      const nomeAgrupamento = cliente.nome_fantasia || cliente.nome;
      
      if (!clientesAgrupados.has(nomeAgrupamento)) {
        // Usar o primeiro cliente do grupo como base, mas com nome agrupado
        clientesAgrupados.set(nomeAgrupamento, {
          ...cliente,
          nome: nomeAgrupamento, // Use nome_fantasia como nome principal
          clientes_originais: []
        });
      }
      
      // Adicionar cliente original ao grupo
      clientesAgrupados.get(nomeAgrupamento).clientes_originais.push(cliente);
    }
    
    // Converter Map para Array
    const clientes = Array.from(clientesAgrupados.values());
    
    console.log(`📋 ${clientesRaw?.length || 0} clientes únicos carregados, ${clientes.length} grupos por nome fantasia`);

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

    // Processar clientes em lotes menores de 5 para evitar timeout
    const batchSize = 5;
    const maxProcessingTime = 45000; // 45 segundos limite
    const startTime = Date.now();
    
    for (let i = 0; i < (clientes?.length || 0); i += batchSize) {
      // Verificar timeout
      if (Date.now() - startTime > maxProcessingTime) {
        console.log(`⏱️ Timeout atingido, processando ${resumo.clientes_processados} de ${clientes?.length || 0} clientes`);
        break;
      }
      
      const batch = clientes?.slice(i, i + batchSize) || [];
      console.log(`🔄 Processando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil((clientes?.length || 0)/batchSize)} (${batch.length} clientes)`);

      for (const cliente of batch) {
        // Verificar timeout individual por cliente
        if (Date.now() - startTime > maxProcessingTime) {
          console.log(`⏱️ Timeout atingido durante processamento de ${cliente.nome}`);
          break;
        }
        
        try {
          let nomeCliente = cliente.nome_fantasia || cliente.nome_mobilemed || cliente.nome;
          console.log(`🔍 Buscando volumetria para cliente: ${nomeCliente} no período ${periodo}`);

          // Buscar dados de volumetria - otimizado para evitar loops aninhados
          let volumetriaData = [];
          let nomeEncontrado = nomeCliente;
          
          // Coletar todos os nomes únicos de uma vez
          const clientesParaBuscar = cliente.clientes_originais || [cliente];
          const todosNomes = new Set();
          
          for (const clienteOriginal of clientesParaBuscar) {
            [clienteOriginal.nome_fantasia, clienteOriginal.nome_mobilemed, clienteOriginal.nome]
              .filter(n => n?.trim())
              .forEach(nome => todosNomes.add(nome));
          }
          
          if (todosNomes.size > 0) {
            // Fazer uma única consulta com todos os nomes
            const nomesArray = Array.from(todosNomes);
            const { data: dados, error } = await supabase
              .from('volumetria_mobilemed')
              .select('*')
              .eq('periodo_referencia', periodo)
              .or(nomesArray.map(nome => `"Cliente_Nome_Fantasia".eq."${nome}","EMPRESA".eq."${nome}"`).join(','))
              .neq('arquivo_fonte', 'volumetria_onco_padrao');
            
            if (!error && dados && dados.length > 0) {
              volumetriaData = dados;
              nomeEncontrado = nomesArray[0];
              console.log(`📊 Encontrados ${dados.length} registros para ${nomeCliente} (agrupado como ${nomeCliente})`);
            }
          }
          
          // Remover duplicatas baseado em ACCESSION_NUMBER + DATA_REALIZACAO
          const volumetriaUnica = volumetriaData.filter((item, index, array) => {
            const chave = `${item.ACCESSION_NUMBER}_${item.DATA_REALIZACAO}`;
            return array.findIndex(other => `${other.ACCESSION_NUMBER}_${other.DATA_REALIZACAO}` === chave) === index;
          });

          if (!volumetriaUnica || volumetriaUnica.length === 0) {
            console.log(`📊 Cliente ${nomeCliente}: Sem registros na volumetria para período ${periodo}`);
            // Persistir status para refletir no painel "Status por Cliente"
            await supabase
              .from('demonstrativos_faturamento_calculados')
              .insert({
                periodo_referencia: periodo,
                cliente_id: cliente.id,
                cliente_nome: nomeCliente,
                status: 'sem_volumetria'
              });
            continue;
          }

          // Usar volumetria única (sem duplicatas)
          volumetriaData = volumetriaUnica;
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

            // Verificar se o cliente tem plantão/urgência na prioridade
            const prio = (grupo.prioridade || '').toString().toUpperCase();
            const isPlantao = prio.includes('PLANTÃO') || prio.includes('PLANTAO') || prio.includes('URGENTE') || prio.includes('URGÊNCIA');

            // Usar a função RPC para calcular preço com timeout
            let valorUnitario = 0;
            
            try {
              // Primeiro tentar buscar preço diretamente na tabela (mais rápido)
              const { data: precosDireto, error: precosDiretoError } = await supabase
                .from('precos_servicos')
                .select('valor_base, valor_urgencia, considera_prioridade_plantao')
                .eq('cliente_id', cliente.id)
                .eq('modalidade', grupo.modalidade)
                .eq('especialidade', grupo.especialidade)
                .eq('categoria', grupo.categoria || 'SC')
                .eq('ativo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (precosDireto && !precosDiretoError) {
                // Se considera plantão e é plantão, usar valor_urgencia, senão valor_base
                if (precosDireto.considera_prioridade_plantao && isPlantao) {
                  valorUnitario = Number(precosDireto.valor_urgencia || precosDireto.valor_base || 0);
                } else {
                  valorUnitario = Number(precosDireto.valor_base || 0);
                }
                console.log(`💰 Preço encontrado diretamente para ${nomeCliente} - ${chave}: R$ ${valorUnitario}`);
              } else {
                // Fallback para valor padrão se não encontrar preço
                console.log(`⚠️ Preço não encontrado para ${nomeCliente} - ${chave}, usando valor padrão`);
                valorUnitario = 0;
              }
            } catch (error) {
              console.error(`❌ Erro na busca de preço para ${nomeCliente} - ${chave}:`, error);
              valorUnitario = 0;
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
          const parametrosFaturamentoArr = Array.isArray(cliente.parametros_faturamento)
            ? cliente.parametros_faturamento
            : (cliente.parametros_faturamento ? [cliente.parametros_faturamento] : []);
          const parametrosFaturamento = parametrosFaturamentoArr.find((p: any) => p.status === 'A') || {};

          // Calcular franquia, portal e integração diretamente (mais rápido que RPC)
          console.log(`💰 Calculando faturamento completo para ${nomeCliente}...`);
          
          let valorFranquia = 0;
          let valorPortal = 0;
          let valorIntegracao = 0;
          
          try {
            // Calcular franquia baseado nos parâmetros
            if (parametrosFaturamento.aplicar_franquia) {
              if (parametrosFaturamento.frequencia_continua) {
                // Frequência contínua sempre cobra
                valorFranquia = Number(parametrosFaturamento.valor_franquia || 0);
              } else if (totalExames > 0) {
                // Só cobra se houver volume
                valorFranquia = Number(parametrosFaturamento.valor_franquia || 0);
              }
            }
            
            // Calcular portal e integração
            if (parametrosFaturamento.portal_laudos) {
              valorPortal = Number(parametrosFaturamento.valor_integracao || 0);
            }
            if (parametrosFaturamento.cobrar_integracao) {
              valorIntegracao = Number(parametrosFaturamento.valor_integracao || 0);
            }
          } catch (error) {
            console.error(`❌ Erro no cálculo de faturamento para ${nomeCliente}:`, error);
          }

          const franquia = {
            valor_franquia: valorFranquia,
            valor_portal_laudos: valorPortal,
            valor_integracao: valorIntegracao
          };
          
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
            valor_total_faturamento: valorLiquido, // CORRIGIDO: deve ser o valor líquido (após impostos)
            detalhes_franquia: franquia.detalhes_franquia || {},
            detalhes_exames: detalhesExames,
            parametros_utilizados: {
              contrato: contrato,
              parametros_faturamento: parametrosFaturamento,
              eh_simples_nacional: ehSimplesNacional
            }
          };

          // Adicionar ao retorno antes de persistir (não bloquear UI)
          demonstrativos.push(demonstrativo);

          // Atualizar resumo imediatamente
          resumo.clientes_processados++;
          resumo.total_exames_geral += totalExames;
          resumo.valor_bruto_geral += valorBrutoTotal;
          resumo.valor_impostos_geral += valorTotalImpostos;
          resumo.valor_total_geral += valorLiquido; // CORRIGIDO: somar valor líquido, não bruto
          resumo.valor_exames_geral += valorExamesTotal;
          resumo.valor_franquias_geral += (franquia.valor_franquia || 0);
          resumo.valor_portal_geral += (franquia.valor_portal_laudos || 0);
          resumo.valor_integracao_geral += (franquia.valor_integracao || 0);

          if (ehSimplesNacional) {
            resumo.clientes_simples_nacional++;
          } else {
            resumo.clientes_regime_normal++;
          }

          // Persistir de forma tolerante a falhas
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
              valor_total_faturamento: valorLiquido, // CORRIGIDO: deve ser o valor líquido (após impostos)
              detalhes_franquia: franquia.detalhes_franquia || {},
              detalhes_exames: detalhesExames,
              parametros_utilizados: demonstrativo.parametros_utilizados,
              status: 'calculado'
            });

          if (insertError) {
            console.error(`❌ Erro ao salvar demonstrativo para ${nomeCliente}:`, insertError);
            // segue o processamento sem interromper
          } else {
            console.log(`✅ Demonstrativo salvo com sucesso para ${nomeCliente}`);
          }

        } catch (error) {
          console.error(`❌ Erro ao processar cliente ${cliente.nome}:`, error);
          
          // Salvar erro na tabela com status específico
          await supabase
            .from('demonstrativos_faturamento_calculados')
            .insert({
              periodo_referencia: periodo,
              cliente_id: cliente.id,
              cliente_nome: cliente.nome_mobilemed || cliente.nome_fantasia || cliente.nome,
              status: 'erro_processamento',
              erro_detalhes: error instanceof Error ? error.message : String(error),
              total_exames: 0,
              valor_bruto_total: 0,
              valor_total_faturamento: 0
            });
          
          // Continuar processamento dos outros clientes
          console.log(`⚠️ Cliente ${cliente.nome} teve erro mas processamento continua...`);
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