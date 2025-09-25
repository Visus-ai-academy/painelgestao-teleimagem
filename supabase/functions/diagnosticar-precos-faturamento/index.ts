import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cliente_nome, periodo = "2025-06" } = await req.json();
    
    console.log(`🔍 Diagnosticando preços para cliente: ${cliente_nome}, período: ${periodo}`);

    // 1. Buscar o cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, nome_mobilemed, ativo')
      .or(`nome.eq.${cliente_nome},nome_fantasia.eq.${cliente_nome},nome_mobilemed.eq.${cliente_nome}`)
      .single();

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cliente não encontrado: ${cliente_nome}`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Cliente encontrado:`, cliente);

    // 2. Buscar volumetria do cliente
    const { data: volumetria } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .or(`"EMPRESA".eq.${cliente_nome},"Cliente_Nome_Fantasia".eq.${cliente_nome}`)
      .eq('periodo_referencia', periodo)
      .limit(50);

    console.log(`📊 Volumetria encontrada: ${volumetria?.length || 0} registros`);

    // 3. Agrupar exames por modalidade/especialidade/categoria/prioridade
    const gruposExames: Record<string, { modalidade: string; especialidade: string; categoria: string; prioridade: string; quantidade: number }> = {};
    
    for (const vol of volumetria || []) {
      const modalidade = (vol.MODALIDADE || '').toString();
      const especialidade = (vol.ESPECIALIDADE || '').toString();
      const categoria = (vol.CATEGORIA || 'SC').toString();
      const prioridade = (vol.PRIORIDADE || '').toString();
      const key = `${modalidade}|${especialidade}|${categoria}|${prioridade}`;
      const qtd = Number(vol.VALORES || 0) || 0;
      
      if (!gruposExames[key]) {
        gruposExames[key] = { modalidade, especialidade, categoria, prioridade, quantidade: 0 };
      }
      gruposExames[key].quantidade += qtd;
    }

    console.log(`🔢 Grupos de exames identificados: ${Object.keys(gruposExames).length}`);

    // 4. Para cada grupo, verificar se existe preço
    const diagnosticoPrecos = [];
    for (const [key, grupo] of Object.entries(gruposExames)) {
      // Buscar preço exato
      const { data: precoExato } = await supabase
        .from('precos_servicos')
        .select('valor_base, valor_urgencia, ativo')
        .eq('cliente_id', cliente.id)
        .eq('modalidade', grupo.modalidade)
        .eq('especialidade', grupo.especialidade)
        .eq('categoria', grupo.categoria)
        .eq('prioridade', grupo.prioridade)
        .eq('ativo', true)
        .maybeSingle();

      // Buscar preços alternativos (sem prioridade)
      const { data: precoSemPrioridade } = await supabase
        .from('precos_servicos')
        .select('valor_base, valor_urgencia, ativo, prioridade')
        .eq('cliente_id', cliente.id)
        .eq('modalidade', grupo.modalidade)
        .eq('especialidade', grupo.especialidade)
        .eq('categoria', grupo.categoria)
        .eq('ativo', true);

      // Buscar todos os preços do cliente para esta modalidade/especialidade
      const { data: precosCliente } = await supabase
        .from('precos_servicos')
        .select('*')
        .eq('cliente_id', cliente.id)
        .eq('modalidade', grupo.modalidade)
        .eq('especialidade', grupo.especialidade)
        .eq('ativo', true);

      diagnosticoPrecos.push({
        combinacao: key,
        grupo: grupo,
        preco_exato: precoExato,
        precos_sem_prioridade: precoSemPrioridade,
        total_precos_modalidade_especialidade: precosCliente?.length || 0,
        precos_exemplo: precosCliente?.slice(0, 3) || []
      });
    }

    // 5. Estatísticas gerais do cliente
    const { data: totalPrecos } = await supabase
      .from('precos_servicos')
      .select('id', { count: 'exact' })
      .eq('cliente_id', cliente.id)
      .eq('ativo', true);

    const { data: parametrosFaturamento } = await supabase
      .from('parametros_faturamento')
      .select('*')
      .eq('cliente_id', cliente.id)
      .eq('status', 'A')
      .maybeSingle();

    return new Response(JSON.stringify({
      success: true,
      cliente: cliente,
      periodo: periodo,
      estatisticas: {
        total_volumetria: volumetria?.length || 0,
        total_grupos_exames: Object.keys(gruposExames).length,
        total_precos_cliente: totalPrecos?.[0]?.count || 0,
        tem_parametros_faturamento: !!parametrosFaturamento
      },
      parametros_faturamento: parametrosFaturamento,
      diagnostico_precos: diagnosticoPrecos,
      resumo: {
        grupos_com_preco_exato: diagnosticoPrecos.filter(d => d.preco_exato).length,
        grupos_sem_preco: diagnosticoPrecos.filter(d => !d.preco_exato && (!d.precos_sem_prioridade || d.precos_sem_prioridade.length === 0)).length,
        grupos_com_preco_alternativo: diagnosticoPrecos.filter(d => !d.preco_exato && d.precos_sem_prioridade && d.precos_sem_prioridade.length > 0).length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});