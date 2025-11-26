import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando sincronização de tipo_cliente...');

    // Buscar todos os clientes ativos com contratos ativos
    const { data: clientesComContratos, error: fetchError } = await supabase
      .from('clientes')
      .select(`
        id,
        nome,
        tipo_cliente,
        contratos_clientes!inner(
          tipo_cliente,
          status
        )
      `)
      .eq('ativo', true)
      .eq('contratos_clientes.status', 'ativo');

    if (fetchError) {
      console.error('❌ Erro ao buscar clientes:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Total de clientes com contratos ativos: ${clientesComContratos?.length || 0}`);

    const clientesParaAtualizar: Array<{
      id: string;
      nome: string;
      tipo_cliente_antigo: string | null;
      tipo_cliente_novo: string;
    }> = [];

    // Identificar clientes que precisam ser atualizados
    for (const cliente of clientesComContratos || []) {
      const contratos = Array.isArray(cliente.contratos_clientes) 
        ? cliente.contratos_clientes 
        : [cliente.contratos_clientes];
      
      // Pegar o primeiro contrato ativo (assumindo que há apenas um contrato ativo por cliente)
      const contratoAtivo = contratos[0];
      
      if (contratoAtivo && cliente.tipo_cliente !== contratoAtivo.tipo_cliente) {
        clientesParaAtualizar.push({
          id: cliente.id,
          nome: cliente.nome,
          tipo_cliente_antigo: cliente.tipo_cliente,
          tipo_cliente_novo: contratoAtivo.tipo_cliente
        });
      }
    }

    console.log(`🔍 Clientes com divergência: ${clientesParaAtualizar.length}`);

    if (clientesParaAtualizar.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos os clientes já estão sincronizados',
          clientesAtualizados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar cada cliente
    let clientesAtualizados = 0;
    const erros: Array<{ nome: string; erro: string }> = [];

    for (const cliente of clientesParaAtualizar) {
      console.log(`📝 Atualizando ${cliente.nome}: ${cliente.tipo_cliente_antigo} → ${cliente.tipo_cliente_novo}`);
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update({ 
          tipo_cliente: cliente.tipo_cliente_novo,
          updated_at: new Date().toISOString()
        })
        .eq('id', cliente.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar ${cliente.nome}:`, updateError);
        erros.push({ nome: cliente.nome, erro: updateError.message });
      } else {
        clientesAtualizados++;
        console.log(`✅ ${cliente.nome} atualizado com sucesso`);
      }
    }

    console.log(`✅ Sincronização concluída: ${clientesAtualizados} clientes atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída com sucesso`,
        clientesAtualizados,
        totalDivergencias: clientesParaAtualizar.length,
        detalhes: clientesParaAtualizar,
        erros: erros.length > 0 ? erros : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
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
