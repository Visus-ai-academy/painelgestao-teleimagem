import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DemonstrativoCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  valor_exames: number;
  valor_franquia: number;
  valor_portal_laudos: number;
  valor_integracao: number;
  valor_bruto: number;
  valor_impostos: number;
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
  detalhes_tributacao: {
    simples_nacional: boolean;
    percentual_iss?: number;
    valor_iss?: number;
    base_calculo?: number;
  };
  alertas?: string[]; // ✅ Novo campo para alertas de problemas
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

    const { periodo } = await req.json();
    
    if (!periodo) {
      throw new Error('Período é obrigatório');
    }

    console.log(`Gerando demonstrativos para o período: ${periodo}`);

    // Buscar todos os clientes ativos com parâmetros incluindo Simples Nacional
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        parametros_faturamento!inner(
          status,
          aplicar_franquia,
          valor_franquia,
          simples,
          percentual_iss
        )
      `)
      .eq('ativo', true)
      .eq('parametros_faturamento.status', 'A');

    if (clientesError) {
      throw new Error(`Erro ao buscar clientes: ${clientesError.message}`);
    }

    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Nenhum cliente com parâmetros ativos encontrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${clientes.length} clientes...`);

    // Agrupar clientes por nome_fantasia para evitar duplicatas 
    const clientesAgrupados = new Map();
    
    for (const cliente of clientes) {
      const nomeFantasia = cliente.nome_fantasia || cliente.nome;
      
      if (!clientesAgrupados.has(nomeFantasia)) {
        clientesAgrupados.set(nomeFantasia, {
          id: cliente.id,
          nome: cliente.nome,
          nome_fantasia: nomeFantasia,
          nomes_mobilemed: [
            cliente.nome, // Nome principal
            cliente.nome_mobilemed, // Nome MobileMed se existir
            nomeFantasia // Nome fantasia
          ].filter(Boolean), // Remove valores null/undefined
          parametros_faturamento: cliente.parametros_faturamento
        });
      } else {
        // Adicionar nomes adicionais para busca na volumetria
        const clienteExistente = clientesAgrupados.get(nomeFantasia);
        if (cliente.nome && !clienteExistente.nomes_mobilemed.includes(cliente.nome)) {
          clienteExistente.nomes_mobilemed.push(cliente.nome);
        }
        if (cliente.nome_mobilemed && !clienteExistente.nomes_mobilemed.includes(cliente.nome_mobilemed)) {
          clienteExistente.nomes_mobilemed.push(cliente.nome_mobilemed);
        }
      }
    }

    console.log(`📋 ${clientesAgrupados.size} clientes únicos após agrupamento por nome fantasia`);

    const demonstrativos: DemonstrativoCliente[] = [];
    let processados = 0;

    // Processar cada cliente agrupado
    for (const cliente of clientesAgrupados.values()) {
      try {
    console.log('Processando cliente:', cliente.nome_fantasia);

    // Buscar volumetria do período DIRETAMENTE no banco - mais eficiente
    console.log(`🔍 Buscando volumetria para cliente: ${cliente.nome_fantasia} no período ${periodo}`);
    
    const { data: volumetria, error: volumetriaError } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        "EMPRESA",
        "MODALIDADE", 
        "ESPECIALIDADE",
        "CATEGORIA",
        "PRIORIDADE", 
        "VALORES",
        "MEDICO",
        "DATA_LAUDO",
        "DATA_PRAZO",
        periodo_referencia
      `)
      .eq('periodo_referencia', periodo)
      .in('"EMPRESA"', cliente.nomes_mobilemed)
      .not('"VALORES"', 'is', null)
      .limit(50000); // Limite alto para garantir que pega todos os dados
    
    if (volumetriaError) {
      console.error(`❌ ERRO ao buscar volumetria para ${cliente.nome_fantasia}:`, volumetriaError);
      continue;
    }
    
    console.log(`📊 Cliente ${cliente.nome_fantasia} (${cliente.nomes_mobilemed.join(', ')}): ${volumetria?.length || 0} registros encontrados na volumetria para período ${periodo}`);
    
    if (volumetria && volumetria.length > 0) {
      // Log uma amostra dos dados encontrados
      console.log(`📋 Amostra volumetria ${cliente.nome_fantasia}:`, volumetria.slice(0, 3).map(v => ({
        modalidade: v.MODALIDADE,
        especialidade: v.ESPECIALIDADE,
        categoria: v.CATEGORIA,
        prioridade: v.PRIORIDADE,
        valores: v.VALORES,
        empresa: v.EMPRESA,
        periodo: v.periodo_referencia
      })));
    } else {
      console.warn(`⚠️ PROBLEMA: Nenhum dado de volumetria encontrado para ${cliente.nome_fantasia} no período ${periodo}`);
      console.log(`🔍 Nomes MobileMed para busca:`, cliente.nomes_mobilemed);
    }

        const totalExames = volumetria?.length || 0;
        const volumeTotal = volumetria?.reduce((sum, item) => sum + (item.VALORES || 0), 0) || 0;
        
        console.log(`📈 Cliente ${cliente.nome_fantasia}: ${totalExames} registros, ${volumeTotal} volume total`);

        // Calcular valores dos exames baseado na tabela de preços
        let valorExames = 0;
        const detalhesExames = [];

        if (volumetria && volumetria.length > 0) {
          // Agrupar exames por modalidade/especialidade/categoria/prioridade
          const grupos = new Map();
          
          for (const exame of volumetria) {
            const chave = `${exame.MODALIDADE}_${exame.ESPECIALIDADE}_${exame.CATEGORIA || 'SC'}_${exame.PRIORIDADE}`;
            if (!grupos.has(chave)) {
              grupos.set(chave, {
                modalidade: exame.MODALIDADE,
                especialidade: exame.ESPECIALIDADE,
                categoria: exame.CATEGORIA || 'SC',
                prioridade: exame.PRIORIDADE,
                quantidade: 0,
                valor_unitario: 0
              });
            }
            grupos.get(chave).quantidade += (exame.VALORES || 1);
          }

          // Calcular preço para cada grupo
          for (const grupo of grupos.values()) {
            try {
              console.log(`🔍 Buscando preço para ${cliente.nome_fantasia}: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade} (${grupo.quantidade} exames)`);
              
              // Verificar se temos todos os dados necessários
              if (!grupo.modalidade || !grupo.especialidade) {
                console.warn(`⚠️ Dados incompletos no grupo:`, grupo);
                continue;
              }

              const { data: preco, error: precoError } = await supabase.rpc('calcular_preco_exame', {
                p_cliente_id: cliente.id,
                p_modalidade: grupo.modalidade,
                p_especialidade: grupo.especialidade,
                p_prioridade: grupo.prioridade,
                p_categoria: grupo.categoria || 'SC',
                p_volume_total: grupo.quantidade,
                p_is_plantao: false
              });

              console.log(`📊 Resultado da função calcular_preco_exame:`, {
                cliente: cliente.nome_fantasia,
                modalidade: grupo.modalidade,
                especialidade: grupo.especialidade,
                prioridade: grupo.prioridade,
                categoria: grupo.categoria,
                quantidade: grupo.quantidade,
                preco_retornado: preco,
                erro: precoError?.message || 'nenhum'
              });

              if (!precoError && preco && preco > 0) {
                grupo.valor_unitario = preco;
                const valorGrupo = grupo.quantidade * preco;
                valorExames += valorGrupo;
                
                detalhesExames.push({
                  ...grupo,
                  valor_total: valorGrupo,
                  status: 'preco_encontrado'
                });
                
                console.log(`💰 Preço encontrado: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade} = R$ ${preco.toFixed(2)} x ${grupo.quantidade} = R$ ${valorGrupo.toFixed(2)}`);
              } else {
                // Sem fallback: respeitar regras existentes e não aplicar valores artificiais
                detalhesExames.push({
                  ...grupo,
                  valor_total: 0,
                  valor_unitario: 0,
                  status: 'preco_nao_encontrado',
                  problema: `Preço não encontrado para ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade}`
                });
                console.warn(`⚠️ Preço NÃO encontrado: ${grupo.modalidade}/${grupo.especialidade}/${grupo.categoria}/${grupo.prioridade}`);
              }
            } catch (error) {
              console.error(`❌ Erro ao calcular preço para ${cliente.nome_fantasia}:`, error);
            }
          }
        }

        // Calcular franquia, portal e integração usando lógica corrigida
        console.log(`💰 Calculando faturamento para ${cliente.nome_fantasia} - Volume: ${volumeTotal}`);
        
        // Buscar parâmetros de faturamento
        const { data: parametrosFaturamento, error: paramsError } = await supabase
          .from('parametros_faturamento')
          .select('*')
          .eq('cliente_id', cliente.id)
          .eq('status', 'A')
          .order('updated_at', { ascending: false })
          .limit(1);

        const parametros = parametrosFaturamento?.[0];
        let valorFranquia = 0;
        let valorPortal = 0;
        let valorIntegracao = 0;
        let detalhesFranquia = {};

        // LÓGICA CORRIGIDA DA FRANQUIA
        if (parametros?.aplicar_franquia) {
          if (parametros.frequencia_continua) {
            // Frequência contínua = SIM: sempre cobra franquia
            if (parametros.frequencia_por_volume && volumeTotal > (parametros.volume_franquia || 0)) {
              valorFranquia = parametros.valor_acima_franquia || parametros.valor_franquia || 0;
              detalhesFranquia = {
                tipo: 'continua_com_volume',
                volume_base: parametros.volume_franquia,
                volume_atual: volumeTotal,
                valor_aplicado: valorFranquia,
                motivo: 'Frequência contínua + volume acima da franquia'
              };
            } else {
              valorFranquia = parametros.valor_franquia || 0;
              detalhesFranquia = {
                tipo: 'continua_normal', 
                volume_atual: volumeTotal,
                valor_aplicado: valorFranquia,
                motivo: 'Frequência contínua - valor base'
              };
            }
          } else {
            // Frequência contínua = NÃO: só cobra se houver volume
            if (volumeTotal > 0) {
              if (parametros.frequencia_por_volume && volumeTotal > (parametros.volume_franquia || 0)) {
                valorFranquia = parametros.valor_acima_franquia || parametros.valor_franquia || 0;
                detalhesFranquia = {
                  tipo: 'volume_acima',
                  volume_base: parametros.volume_franquia,
                  volume_atual: volumeTotal,
                  valor_aplicado: valorFranquia,
                  motivo: 'Volume acima da franquia'
                };
              } else {
                valorFranquia = parametros.valor_franquia || 0;
                detalhesFranquia = {
                  tipo: 'volume_normal',
                  volume_atual: volumeTotal,
                  valor_aplicado: valorFranquia,
                  motivo: 'Volume dentro da franquia'
                };
              }
            } else {
              // ✅ CORREÇÃO: Volume = 0 e frequência contínua = NÃO → Não cobra franquia
              valorFranquia = 0;
              detalhesFranquia = {
                tipo: 'sem_volume',
                volume_atual: 0,
                valor_aplicado: 0,
                motivo: '✅ Sem volume de exames e frequência não contínua - franquia NÃO aplicada'
              };
            }
          }
        } else {
          detalhesFranquia = {
            tipo: 'nao_aplica',
            valor_aplicado: 0,
            motivo: 'Cliente não possui franquia configurada'
          };
        }

        // Portal de Laudos
        if (parametros?.portal_laudos) {
          valorPortal = parametros.valor_integracao || 0;
        }

        // Integração
        if (parametros?.cobrar_integracao) {
          valorIntegracao = parametros.valor_integracao || 0;
        }

        const calculoCompleto = [{
          valor_franquia: valorFranquia,
          valor_portal_laudos: valorPortal,
          valor_integracao: valorIntegracao,
          detalhes_franquia: detalhesFranquia
        }];

        console.log(`📊 Cliente ${cliente.nome_fantasia}: Franquia R$ ${valorFranquia.toFixed(2)} | Portal R$ ${valorPortal.toFixed(2)} | Integração R$ ${valorIntegracao.toFixed(2)}`);
        
        if (valorExames === 0 && volumeTotal > 0) {
          console.log(`⚠️ PROBLEMA: Cliente ${cliente.nome_fantasia} tem ${volumeTotal} exames na volumetria mas valor calculado = R$ 0,00`);
        }

        const calculo = calculoCompleto?.[0];
        if (!calculo) {
          console.warn(`Nenhum resultado de cálculo para ${cliente.nome_fantasia}`);
          continue;
        }

        // Calcular tributação baseado no Simples Nacional
        const parametrosTrib = cliente.parametros_faturamento[0];
        const simplesNacional = parametrosTrib?.simples || false;
        const percentualISS = parametrosTrib?.percentual_iss || 0;
        
        const valorBruto = valorExames + (calculo.valor_franquia || 0) + (calculo.valor_portal_laudos || 0) + (calculo.valor_integracao || 0);
        let valorImpostos = 0;
        let valorISS = 0;
        
        // Se NÃO for Simples Nacional, calcular ISS
        if (!simplesNacional && percentualISS > 0) {
          valorISS = valorBruto * (percentualISS / 100);
          valorImpostos = valorISS;
        }
        
        const valorTotal = valorBruto - valorImpostos;

        // Montar demonstrativo com alertas para problemas
        const temProblemas = valorExames === 0 && totalExames > 0;
        const temFranquiaProblema = valorFranquia > 0 && volumeTotal === 0 && !parametros?.frequencia_continua;
        
        const demonstrativo: DemonstrativoCliente = {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.nome,
          periodo,
          total_exames: totalExames,
          valor_exames: valorExames,
          valor_franquia: valorFranquia,
          valor_portal_laudos: valorPortal,
          valor_integracao: valorIntegracao,
          valor_bruto: valorBruto,
          valor_impostos: valorImpostos,
          valor_total: valorTotal,
          detalhes_franquia: detalhesFranquia || {},
          detalhes_exames: detalhesExames,
          detalhes_tributacao: {
            simples_nacional: simplesNacional,
            percentual_iss: percentualISS,
            valor_iss: valorISS,
            base_calculo: valorBruto
          }
        };

        // Adicionar alertas se houver problemas
        if (temProblemas) {
          demonstrativo.alertas = [`⚠️ Cliente tem ${totalExames} exames mas valor R$ 0,00 - verificar tabela de preços`];
        }
        if (temFranquiaProblema) {
          demonstrativo.alertas = demonstrativo.alertas || [];
          demonstrativo.alertas.push(`⚠️ Franquia cobrada sem volume (freq. contínua = false)`);
        }

        demonstrativos.push(demonstrativo);
        processados++;
        
        console.log(`Cliente ${cliente.nome_fantasia} processado com sucesso - Total: R$ ${demonstrativo.valor_total.toFixed(2)} (${totalExames} exames)`);

      } catch (error) {
        console.error(`Erro ao processar cliente ${cliente.nome_fantasia}:`, error);
        continue;
      }
    }

    // Ordenar por valor total (maior primeiro)
    demonstrativos.sort((a, b) => b.valor_total - a.valor_total);

    const resumo = {
      total_clientes: clientes.length,
      clientes_processados: processados,
      valor_bruto_geral: demonstrativos.reduce((sum, d) => sum + d.valor_bruto, 0),
      valor_impostos_geral: demonstrativos.reduce((sum, d) => sum + d.valor_impostos, 0),
      valor_total_geral: demonstrativos.reduce((sum, d) => sum + d.valor_total, 0),
      valor_exames_geral: demonstrativos.reduce((sum, d) => sum + d.valor_exames, 0),
      valor_franquias_geral: demonstrativos.reduce((sum, d) => sum + d.valor_franquia, 0),
      valor_portal_geral: demonstrativos.reduce((sum, d) => sum + d.valor_portal_laudos, 0),
      valor_integracao_geral: demonstrativos.reduce((sum, d) => sum + d.valor_integracao, 0),
      clientes_simples_nacional: demonstrativos.filter(d => d.detalhes_tributacao.simples_nacional).length,
      clientes_regime_normal: demonstrativos.filter(d => !d.detalhes_tributacao.simples_nacional).length
    };

    console.log('Demonstrativos gerados:', resumo);

    // Salvar dados no localStorage do cliente (via resposta)
    const dadosParaSalvar = {
      demonstrativos,
      resumo,
      periodo,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        resumo,
        demonstrativos,
        salvar_localStorage: {
          chave: `demonstrativos_completos_${periodo}`,
          dados: dadosParaSalvar
        },
        message: `Demonstrativos gerados para ${processados} clientes`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar demonstrativos:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});