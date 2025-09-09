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

  console.log('[gerar-demonstrativo-divergencias] INÍCIO DA FUNÇÃO');
  
  try {
    const { periodo } = await req.json();
    console.log('[gerar-demonstrativo-divergencias] Período:', periodo);

    if (!periodo) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Parâmetro periodo é obrigatório' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar registros de volumetria e combinar com dados de clientes
    console.log('[gerar-demonstrativo-divergencias] Buscando dados de volumetria...');

    // Verificar se existem dados para o período - com debug melhorado
    console.log('[gerar-demonstrativo-divergencias] Verificando dados para período:', periodo);
    
    // Primeiro verificar todos os períodos disponíveis para debug
    const { data: todosRegistros, error: debugError } = await supabase
      .from('volumetria_mobilemed')
      .select('periodo_referencia')
      .limit(50);
    
    if (!debugError && todosRegistros) {
      const periodosDisponiveis = [...new Set(todosRegistros.map(r => r.periodo_referencia))];
      console.log('[gerar-demonstrativo-divergencias] Períodos disponíveis na base:', periodosDisponiveis);
    }
    
    const { count: totalCount, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('id', { count: 'exact', head: true })
      .eq('periodo_referencia', periodo);

    if (countError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao contar dados:', countError);
      throw countError;
    }

    console.log(`[gerar-demonstrativo-divergencias] Total de registros no período ${periodo}: ${totalCount || 0}`);

    if (!totalCount || totalCount === 0) {
      // Tentar buscar com variações de formato para debug
      const { count: countAlt1 } = await supabase
        .from('volumetria_mobilemed')
        .select('id', { count: 'exact', head: true })
        .ilike('periodo_referencia', `%${periodo}%`);
        
      console.log(`[gerar-demonstrativo-divergencias] Tentativa com LIKE %${periodo}%: ${countAlt1 || 0} registros`);
      
      return new Response(JSON.stringify({
        success: false,
        error: `Dados não encontrados. Nenhum dado encontrado para ${periodo}. Verifique se há dados volumétricos carregados para este período.`,
        debug: {
          periodo_buscado: periodo,
          registros_encontrados: totalCount || 0,
          periodos_disponiveis: todosRegistros?.map(r => r.periodo_referencia).slice(0, 10) || []
        }
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Buscar clientes únicos na volumetria
    const { data: clientesVolumetria, error: clientesError } = await supabase
      .from('volumetria_mobilemed')
      .select('"EMPRESA"')
      .eq('periodo_referencia', periodo)
      .not('"EMPRESA"', 'is', null);

    if (clientesError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao buscar clientes:', clientesError);
      throw clientesError;
    }

    const clientesUnicos = [...new Set(clientesVolumetria?.map(c => c.EMPRESA).filter(Boolean) || [])];
    console.log(`[gerar-demonstrativo-divergencias] Clientes únicos encontrados: ${clientesUnicos.length}`);

    // Buscar todos os clientes cadastrados de uma vez
    const { data: clientesCadastrados, error: cadastroError } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, nome_mobilemed')
      .in('nome_mobilemed', clientesUnicos);

    if (cadastroError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao buscar cadastro de clientes:', cadastroError);
    }

    const mapaClientes = new Map();
    clientesCadastrados?.forEach(cliente => {
      if (cliente.nome_mobilemed) {
        mapaClientes.set(cliente.nome_mobilemed, cliente);
      }
    });

    // Buscar combinações únicas de exames/preços que podem ter problemas - OTIMIZADA
    console.log('[gerar-demonstrativo-divergencias] Buscando combinações otimizadas...');
    
    const { data: combinacoes, error: combError } = await supabase
      .from('volumetria_mobilemed')
      .select(`
        "EMPRESA",
        "ESTUDO_DESCRICAO",
        "MODALIDADE",
        "ESPECIALIDADE", 
        "CATEGORIA",
        "PRIORIDADE",
        "VALORES"
      `)
      .eq('periodo_referencia', periodo)
      .not('"EMPRESA"', 'is', null)
      .not('"MODALIDADE"', 'is', null)
      .not('"ESPECIALIDADE"', 'is', null)
      .order('"EMPRESA"')
      .limit(2000); // Aumentado limite mas ainda controlado

    if (combError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao buscar combinações:', combError);
      throw combError;
    }

    console.log(`[gerar-demonstrativo-divergencias] Combinações encontradas: ${combinacoes?.length || 0}`);

    // Processar divergências com limite de tempo otimizado
    const divergenciasDetalhadas = [];
    const clientesProcessados = new Set();
    const combinacoesProcessadas = new Set();
    const maxProcessamentos = Math.min(combinacoes?.length || 0, 500); // Limitar processamentos para evitar timeout

    console.log(`[gerar-demonstrativo-divergencias] Processando ${maxProcessamentos} de ${combinacoes?.length || 0} combinações`);

    for (let i = 0; i < maxProcessamentos && i < (combinacoes?.length || 0); i++) {
      const registro = combinacoes[i];
      const clienteEmpresa = registro.EMPRESA;
      const combinacaoKey = `${clienteEmpresa}-${registro.MODALIDADE}-${registro.ESPECIALIDADE}-${registro.CATEGORIA}-${registro.PRIORIDADE}`;
      
      // Evitar processar a mesma combinação duas vezes
      if (combinacoesProcessadas.has(combinacaoKey)) {
        continue;
      }
      combinacoesProcessadas.add(combinacaoKey);

      const cliente = mapaClientes.get(clienteEmpresa);
      
      if (!cliente) {
        divergenciasDetalhadas.push({
          cliente: clienteEmpresa,
          exame: registro.ESTUDO_DESCRICAO,
          modalidade: registro.MODALIDADE,
          especialidade: registro.ESPECIALIDADE,
          categoria: registro.CATEGORIA,
          prioridade: registro.PRIORIDADE,
          valor_volumetria: registro.VALORES,
          motivo: 'Cliente não encontrado no cadastro de clientes',
          tipo: 'cliente_nao_encontrado'
        });
        clientesProcessados.add(clienteEmpresa);
        continue;
      }

      // Verificar se tem preço configurado (usando try-catch para não parar por timeout)
      // Otimizado: só verificar se não há muitas divergências já encontradas
      if (divergenciasDetalhadas.length < 200) {
        try {
          const { data: preco, error: precoError } = await supabase
            .rpc('calcular_preco_exame', {
              p_cliente_id: cliente.id,
              p_modalidade: registro.MODALIDADE,
              p_especialidade: registro.ESPECIALIDADE,
              p_prioridade: registro.PRIORIDADE,
              p_categoria: registro.CATEGORIA,
              p_volume_total: 1
            });

          if (precoError) {
            console.warn(`[gerar-demonstrativo-divergencias] Erro RPC para ${clienteEmpresa}:`, precoError);
            continue; // Pular em caso de erro para não parar o processo
          }

          if (!preco || preco <= 0) {
            divergenciasDetalhadas.push({
              cliente: clienteEmpresa,
              cliente_id: cliente.id,
              exame: registro.ESTUDO_DESCRICAO,
              modalidade: registro.MODALIDADE,
              especialidade: registro.ESPECIALIDADE,
              categoria: registro.CATEGORIA,
              prioridade: registro.PRIORIDADE,
              valor_volumetria: registro.VALORES,
              motivo: 'Preço não configurado para esta combinação MOD/ESP/CAT/PRI',
              tipo: 'sem_preco'
            });
          }
        } catch (precoError) {
          console.error(`[gerar-demonstrativo-divergencias] Erro ao calcular preço para ${clienteEmpresa}:`, precoError);
          // Não adicionar divergência por erro - só continuar
          continue;
        }
      }
      
      clientesProcessados.add(clienteEmpresa);
    }

    // Gerar resumo otimizado
    const resumo = {
      periodo,
      total_divergencias: divergenciasDetalhadas.length,
      por_tipo: {
        sem_preco: divergenciasDetalhadas.filter(d => d.tipo === 'sem_preco').length,
        cliente_nao_encontrado: divergenciasDetalhadas.filter(d => d.tipo === 'cliente_nao_encontrado').length,
        erro_preco: divergenciasDetalhadas.filter(d => d.tipo === 'erro_preco').length
      },
      clientes_com_problema: [...clientesProcessados].length,
      clientes_total_periodo: clientesUnicos.length,
      combinacoes_processadas: combinacoesProcessadas.size,
      registros_analisados: maxProcessamentos,
      total_registros_periodo: totalCount
    };

    console.log('[gerar-demonstrativo-divergencias] Resumo final:', resumo);

    return new Response(JSON.stringify({
      success: true,
      periodo,
      resumo,
      divergencias: divergenciasDetalhadas,
      message: `Demonstrativo de divergências gerado: ${divergenciasDetalhadas.length} problemas encontrados`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[gerar-demonstrativo-divergencias] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Erro desconhecido' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});