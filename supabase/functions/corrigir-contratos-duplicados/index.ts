import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResultadoCorrecao {
  cliente_nome: string;
  acao: string;
  numero_contrato_antigo?: string;
  numero_contrato_novo?: string;
  contratos_removidos?: number;
  detalhes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('🔍 Iniciando correção de contratos duplicados...');

    const resultados: ResultadoCorrecao[] = [];

    // ETAPA 1: Identificar clientes duplicados
    console.log('\n📋 ETAPA 1: Identificando clientes duplicados...');

    const { data: todosClientes, error: errorClientes } = await supabaseClient
      .from('clientes')
      .select('id, nome_fantasia')
      .eq('ativo', true);

    if (errorClientes) {
      console.error('Erro ao buscar clientes:', errorClientes);
      throw errorClientes;
    }

    // Agrupar clientes por nome_fantasia
    const clientesPorNome = new Map<string, string[]>();
    for (const cliente of todosClientes || []) {
      if (!clientesPorNome.has(cliente.nome_fantasia)) {
        clientesPorNome.set(cliente.nome_fantasia, []);
      }
      clientesPorNome.get(cliente.nome_fantasia)!.push(cliente.id);
    }

    // Identificar duplicados
    const clientesDuplicados = Array.from(clientesPorNome.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([nome, ids]) => ({ nome_fantasia: nome, ids, total: ids.length }));

    console.log(`✅ Encontrados ${clientesDuplicados.length} clientes duplicados`);
    for (const dup of clientesDuplicados) {
      console.log(`   - ${dup.nome_fantasia}: ${dup.total} registros`);
    }

    // ETAPA 2: Corrigir números de contrato baseados nos parâmetros
    console.log('\n📋 ETAPA 2: Corrigindo números de contrato...');

    // Buscar todos os contratos
    const { data: contratos, error: errorContratos } = await supabaseClient
      .from('contratos_clientes')
      .select(`
        id,
        cliente_id,
        numero_contrato,
        clientes!inner (
          nome_fantasia
        )
      `)
      .eq('clientes.ativo', true);

    if (errorContratos) {
      console.error('Erro ao buscar contratos:', errorContratos);
      throw errorContratos;
    }

    console.log(`✅ Encontrados ${contratos?.length || 0} contratos para verificar`);

    // Para cada contrato, verificar se há número nos parâmetros
    for (const contrato of contratos || []) {
      const cliente_nome = (contrato.clientes as any)?.nome_fantasia || 'Desconhecido';

      // Buscar parâmetros de faturamento
      const { data: parametros, error: errorParametros } = await supabaseClient
        .from('parametros_faturamento')
        .select('numero_contrato')
        .eq('cliente_id', contrato.cliente_id)
        .not('numero_contrato', 'is', null)
        .maybeSingle();

      if (errorParametros) {
        console.error(`Erro ao buscar parâmetros para ${cliente_nome}:`, errorParametros);
        continue;
      }

      // Se há número de contrato nos parâmetros e é diferente do atual
      if (parametros?.numero_contrato && parametros.numero_contrato !== contrato.numero_contrato) {
        const numeroAntigo = contrato.numero_contrato;
        const numeroNovo = parametros.numero_contrato;

        // Atualizar número do contrato
        const { error: errorUpdate } = await supabaseClient
          .from('contratos_clientes')
          .update({ numero_contrato: numeroNovo })
          .eq('id', contrato.id);

        if (errorUpdate) {
          console.error(`❌ Erro ao atualizar contrato de ${cliente_nome}:`, errorUpdate);
          resultados.push({
            cliente_nome,
            acao: 'erro_atualizacao',
            numero_contrato_antigo: numeroAntigo,
            numero_contrato_novo: numeroNovo,
            detalhes: errorUpdate.message
          });
        } else {
          console.log(`✅ ${cliente_nome}: ${numeroAntigo} → ${numeroNovo}`);
          resultados.push({
            cliente_nome,
            acao: 'numero_corrigido',
            numero_contrato_antigo: numeroAntigo,
            numero_contrato_novo: numeroNovo
          });
        }
      }
    }

    // ETAPA 3: Identificar e remover contratos duplicados para o mesmo cliente
    console.log('\n📋 ETAPA 3: Removendo contratos duplicados...');

    // Buscar clientes com múltiplos contratos
    const { data: clientesMultiplosContratos, error: errorMultiplos } = await supabaseClient
      .from('contratos_clientes')
      .select(`
        cliente_id,
        clientes!inner (
          nome_fantasia
        )
      `)
      .eq('clientes.ativo', true);

    if (!errorMultiplos && clientesMultiplosContratos) {
      // Agrupar por cliente_id
      const contratosPorCliente = new Map<string, any[]>();
      
      for (const c of clientesMultiplosContratos) {
        const clienteId = c.cliente_id;
        if (!contratosPorCliente.has(clienteId)) {
          contratosPorCliente.set(clienteId, []);
        }
        contratosPorCliente.get(clienteId)!.push(c);
      }

      // Para cada cliente com múltiplos contratos
      for (const [clienteId, contratos] of contratosPorCliente.entries()) {
        if (contratos.length > 1) {
          const cliente_nome = (contratos[0].clientes as any)?.nome_fantasia || 'Desconhecido';
          
          // Buscar todos os contratos completos desse cliente
          const { data: contratosCompletos, error: errorCompletos } = await supabaseClient
            .from('contratos_clientes')
            .select('id, numero_contrato, created_at, tem_parametros_configurados, tem_precos_configurados')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });

          if (!errorCompletos && contratosCompletos && contratosCompletos.length > 1) {
            // Identificar o contrato principal (mais recente com parâmetros ou o mais recente)
            const contratoPrincipal = contratosCompletos.find(c => 
              c.tem_parametros_configurados || c.tem_precos_configurados
            ) || contratosCompletos[0];

            // Remover os outros contratos
            const contratosParaRemover = contratosCompletos
              .filter(c => c.id !== contratoPrincipal.id)
              .map(c => c.id);

            if (contratosParaRemover.length > 0) {
              const { error: errorDelete } = await supabaseClient
                .from('contratos_clientes')
                .delete()
                .in('id', contratosParaRemover);

              if (errorDelete) {
                console.error(`❌ Erro ao remover contratos duplicados de ${cliente_nome}:`, errorDelete);
              } else {
                console.log(`✅ ${cliente_nome}: Removidos ${contratosParaRemover.length} contratos duplicados`);
                resultados.push({
                  cliente_nome,
                  acao: 'contratos_removidos',
                  contratos_removidos: contratosParaRemover.length,
                  numero_contrato_novo: contratoPrincipal.numero_contrato
                });
              }
            }
          }
        }
      }
    }

    // ETAPA 4: Relatório final
    console.log('\n📊 RELATÓRIO FINAL:');
    console.log(`Total de ações realizadas: ${resultados.length}`);
    
    const agrupadoPorAcao = resultados.reduce((acc, r) => {
      acc[r.acao] = (acc[r.acao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Resumo por tipo de ação:', agrupadoPorAcao);

    return new Response(
      JSON.stringify({
        sucesso: true,
        total_acoes: resultados.length,
        resumo: agrupadoPorAcao,
        detalhes: resultados
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
