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

    // Verificar se existem dados para o período
    const { data: countData, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .eq('periodo_referencia', periodo);

    if (countError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao contar dados:', countError);
      throw countError;
    }

    console.log(`[gerar-demonstrativo-divergencias] Total de registros no período: ${countData?.length || 0}`);

    if (!countData || countData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Dados não encontrados. Nenhum dado encontrado para ${periodo}. Verifique se há dados de volumetria carregados para este período.`
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

    // Buscar combinações únicas de exames/preços que podem ter problemas
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
      .limit(1000); // Limitar para evitar timeout

    if (combError) {
      console.error('[gerar-demonstrativo-divergencias] Erro ao buscar combinações:', combError);
      throw combError;
    }

    console.log(`[gerar-demonstrativo-divergencias] Combinações encontradas: ${combinacoes?.length || 0}`);

    // Processar divergências
    const divergenciasDetalhadas = [];
    const clientesProcessados = new Set();
    const combinacoesProcessadas = new Set();

    for (const registro of combinacoes || []) {
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
      try {
        const { data: preco } = await supabase
          .rpc('calcular_preco_exame', {
            p_cliente_id: cliente.id,
            p_modalidade: registro.MODALIDADE,
            p_especialidade: registro.ESPECIALIDADE,
            p_prioridade: registro.PRIORIDADE,
            p_categoria: registro.CATEGORIA,
            p_volume_total: 1
          });

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
        divergenciasDetalhadas.push({
          cliente: clienteEmpresa,
          cliente_id: cliente.id,
          exame: registro.ESTUDO_DESCRICAO,
          modalidade: registro.MODALIDADE,
          especialidade: registro.ESPECIALIDADE,
          categoria: registro.CATEGORIA,
          prioridade: registro.PRIORIDADE,
          valor_volumetria: registro.VALORES,
          motivo: 'Erro ao verificar preço configurado',
          tipo: 'erro_preco'
        });
      }
      
      clientesProcessados.add(clienteEmpresa);
    }

    // Gerar resumo
    const resumo = {
      periodo,
      total_divergencias: divergenciasDetalhadas.length,
      por_tipo: {
        sem_preco: divergenciasDetalhadas.filter(d => d.tipo === 'sem_preco').length,
        cliente_nao_encontrado: divergenciasDetalhadas.filter(d => d.tipo === 'cliente_nao_encontrado').length,
        erro_preco: divergenciasDetalhadas.filter(d => d.tipo === 'erro_preco').length
      },
      clientes_com_problema: [...clientesProcessados].length,
      clientes_total_periodo: clientesUnicos.length
    };

    console.log('[gerar-demonstrativo-divergencias] Resumo:', resumo);

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