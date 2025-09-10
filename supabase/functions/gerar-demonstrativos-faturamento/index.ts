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
  valor_total: number;
  detalhes_franquia: any;
  detalhes_exames: any[];
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

    // Buscar todos os clientes ativos com parâmetros
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        parametros_faturamento!inner(
          status,
          aplicar_franquia,
          valor_franquia
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

    const demonstrativos: DemonstrativoCliente[] = [];
    let processados = 0;

    // Processar cada cliente
    for (const cliente of clientes) {
      try {
        console.log(`Processando cliente: ${cliente.nome}`);

        // Buscar volumetria do período para calcular volume total
        const { data: volumetria, error: volumetriaError } = await supabase
          .from('volumetria_mobilemed')
          .select('VALORES, MODALIDADE, ESPECIALIDADE, PRIORIDADE, CATEGORIA, ESTUDO_DESCRICAO')
          .ilike('EMPRESA', cliente.nome)
          .eq('periodo_referencia', periodo);

        if (volumetriaError) {
          console.error(`Erro na volumetria para ${cliente.nome}:`, volumetriaError);
          continue;
        }

        const totalExames = volumetria?.length || 0;
        const volumeTotal = volumetria?.reduce((sum, item) => sum + (item.VALORES || 0), 0) || 0;

        // Calcular valores dos exames baseado na tabela de preços
        let valorExames = 0;
        const detalhesExames = [];

        if (volumetria && volumetria.length > 0) {
          // Agrupar exames por modalidade/especialidade/categoria/prioridade
          const grupos = new Map();
          
          for (const exame of volumetria) {
            const chave = `${exame.MODALIDADE}_${exame.ESPECIALIDADE}_${exame.CATEGORIA}_${exame.PRIORIDADE}`;
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
            grupos.get(chave).quantidade += (exame.VALORES || 0);
          }

          // Calcular preço para cada grupo
          for (const grupo of grupos.values()) {
            try {
              const { data: preco, error: precoError } = await supabase.rpc('calcular_preco_exame', {
                p_cliente_id: cliente.id,
                p_modalidade: grupo.modalidade,
                p_especialidade: grupo.especialidade,
                p_prioridade: grupo.prioridade,
                p_categoria: grupo.categoria,
                p_volume_total: grupo.quantidade,
                p_is_plantao: false
              });

              if (!precoError && preco) {
                grupo.valor_unitario = preco;
                const valorGrupo = grupo.quantidade * preco;
                valorExames += valorGrupo;
                
                detalhesExames.push({
                  ...grupo,
                  valor_total: valorGrupo
                });
              }
            } catch (error) {
              console.error(`Erro ao calcular preço para ${cliente.nome}:`, error);
            }
          }
        }

        // Calcular franquia, portal e integração
        const { data: calculoCompleto, error: calculoError } = await supabase.rpc(
          'calcular_faturamento_completo',
          {
            p_cliente_id: cliente.id,
            p_periodo: periodo,
            p_volume_total: volumeTotal
          }
        );

        if (calculoError) {
          console.error(`Erro no cálculo completo para ${cliente.nome}:`, calculoError);
          continue;
        }

        const calculo = calculoCompleto?.[0];
        if (!calculo) {
          console.warn(`Nenhum resultado de cálculo para ${cliente.nome}`);
          continue;
        }

        // Montar demonstrativo
        const demonstrativo: DemonstrativoCliente = {
          cliente_id: cliente.id,
          cliente_nome: cliente.nome_fantasia || cliente.nome,
          periodo,
          total_exames: totalExames,
          valor_exames: valorExames,
          valor_franquia: calculo.valor_franquia || 0,
          valor_portal_laudos: calculo.valor_portal_laudos || 0,
          valor_integracao: calculo.valor_integracao || 0,
          valor_total: valorExames + (calculo.valor_franquia || 0) + (calculo.valor_portal_laudos || 0) + (calculo.valor_integracao || 0),
          detalhes_franquia: calculo.detalhes_franquia || {},
          detalhes_exames: detalhesExames
        };

        demonstrativos.push(demonstrativo);
        processados++;
        
        console.log(`Cliente ${cliente.nome} processado com sucesso - Total: R$ ${demonstrativo.valor_total.toFixed(2)}`);

      } catch (error) {
        console.error(`Erro ao processar cliente ${cliente.nome}:`, error);
        continue;
      }
    }

    // Ordenar por valor total (maior primeiro)
    demonstrativos.sort((a, b) => b.valor_total - a.valor_total);

    const resumo = {
      total_clientes: clientes.length,
      clientes_processados: processados,
      valor_total_geral: demonstrativos.reduce((sum, d) => sum + d.valor_total, 0),
      valor_exames_geral: demonstrativos.reduce((sum, d) => sum + d.valor_exames, 0),
      valor_franquias_geral: demonstrativos.reduce((sum, d) => sum + d.valor_franquia, 0),
      valor_portal_geral: demonstrativos.reduce((sum, d) => sum + d.valor_portal_laudos, 0),
      valor_integracao_geral: demonstrativos.reduce((sum, d) => sum + d.valor_integracao, 0)
    };

    console.log('Demonstrativos gerados:', resumo);

    return new Response(
      JSON.stringify({
        success: true,
        periodo,
        resumo,
        demonstrativos,
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