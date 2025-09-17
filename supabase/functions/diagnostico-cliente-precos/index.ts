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

    const { cliente_nome } = await req.json();
    
    console.log(`🔍 Diagnosticando cliente: ${cliente_nome}`);

    // 1. Buscar TODOS os registros do cliente (duplicatas)
    const { data: todosRegistros } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        nome_fantasia,
        nome_mobilemed,
        ativo,
        status
      `)
      .or(`nome.eq.${cliente_nome},nome_fantasia.eq.${cliente_nome},nome_mobilemed.eq.${cliente_nome}`);

    // 2. Para cada registro, verificar se tem preços
    const diagnostico = [];
    
    for (const cliente of todosRegistros || []) {
      const { data: precos } = await supabase
        .from('precos_servicos')
        .select('id, modalidade, especialidade, categoria, valor_base, ativo')
        .eq('cliente_id', cliente.id)
        .eq('ativo', true)
        .limit(5);

      // 3. Verificar se tem parâmetros de faturamento
      const { data: parametros } = await supabase
        .from('parametros_faturamento')
        .select('id, status, tipo_faturamento')
        .eq('cliente_id', cliente.id)
        .eq('status', 'A');

      // 4. Simular busca do sistema atual (sem correção)
      const { data: buscaAntiga } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', cliente_nome)
        .limit(1);

      // 5. Simular busca corrigida (com preços)
      const { data: buscaCorrigida } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', cliente_nome)
        .filter('id', 'in', '(SELECT DISTINCT cliente_id FROM precos_servicos WHERE ativo = true)')
        .limit(1);

      diagnostico.push({
        cliente_info: {
          id: cliente.id,
          nome: cliente.nome,
          nome_fantasia: cliente.nome_fantasia,
          nome_mobilemed: cliente.nome_mobilemed,
          ativo: cliente.ativo,
          status: cliente.status
        },
        precos_encontrados: precos?.length || 0,
        precos_exemplos: precos?.slice(0, 3) || [],
        tem_parametros: parametros?.length || 0,
        seria_escolhido_antes: buscaAntiga?.[0]?.id === cliente.id,
        sera_escolhido_agora: buscaCorrigida?.[0]?.id === cliente.id
      });
    }

    // 6. Testar função calcular_preco_exame com exemplo
    const clienteComPrecos = diagnostico.find(d => d.precos_encontrados > 0);
    let testeCalculoPreco = null;
    
    if (clienteComPrecos && clienteComPrecos.precos_exemplos.length > 0) {
      const exemplo = clienteComPrecos.precos_exemplos[0];
      const { data: precoCalculado, error: precoError } = await supabase.rpc('calcular_preco_exame', {
        p_cliente_id: clienteComPrecos.cliente_info.id,
        p_modalidade: exemplo.modalidade,
        p_especialidade: exemplo.especialidade,
        p_categoria: exemplo.categoria || 'SC',
        p_prioridade: 'ROTINA',
        p_volume_total: 1,
        p_is_plantao: false
      });

      testeCalculoPreco = {
        parametros: {
          cliente_id: clienteComPrecos.cliente_info.id,
          modalidade: exemplo.modalidade,
          especialidade: exemplo.especialidade,
          categoria: exemplo.categoria || 'SC'
        },
        preco_retornado: precoCalculado,
        erro: precoError?.message || null
      };
    }

    return new Response(JSON.stringify({
      success: true,
      cliente_pesquisado: cliente_nome,
      total_registros_encontrados: todosRegistros?.length || 0,
      diagnostico: diagnostico,
      teste_calculo_preco: testeCalculoPreco,
      resumo: {
        registros_com_precos: diagnostico.filter(d => d.precos_encontrados > 0).length,
        registros_sem_precos: diagnostico.filter(d => d.precos_encontrados === 0).length,
        id_que_seria_usado_antes: diagnostico.find(d => d.seria_escolhido_antes)?.cliente_info.id || 'nenhum',
        id_que_sera_usado_agora: diagnostico.find(d => d.sera_escolhido_agora)?.cliente_info.id || 'nenhum'
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