import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para buscar o tipo correto do cliente dos parâmetros
async function buscarTipoClienteParametros(
  supabase: any,
  clienteId: string
): Promise<"CO" | "NC" | "NC1" | null> {
  const { data: parametros, error } = await supabase
    .from('parametros_faturamento')
    .select('tipo_cliente')
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !parametros) {
    return null;
  }

  return parametros.tipo_cliente;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando sincronização de tipo_cliente baseada nos parâmetros de faturamento...');

    // Buscar todos os clientes ativos
    const { data: clientes, error: fetchError } = await supabase
      .from('clientes')
      .select('id, nome, tipo_cliente')
      .eq('ativo', true);

    if (fetchError) {
      console.error('❌ Erro ao buscar clientes:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Total de clientes ativos: ${clientes?.length || 0}`);

    // Identificar clientes que precisam ter o tipo corrigido baseado nos parâmetros
    const clientesParaCorrigir: Array<{
      id: string;
      nome: string;
      tipo_atual: string | null;
      tipo_correto: string;
    }> = [];

    for (const cliente of clientes || []) {
      // Buscar o tipo correto dos parâmetros de faturamento
      const tipoCorreto = await buscarTipoClienteParametros(supabase, cliente.id);
      
      // Se não encontrou nos parâmetros, pular este cliente
      if (!tipoCorreto) {
        console.log(`⚠️ Cliente ${cliente.nome} não possui parâmetros de faturamento ativos`);
        continue;
      }
      
      if (cliente.tipo_cliente !== tipoCorreto) {
        clientesParaCorrigir.push({
          id: cliente.id,
          nome: cliente.nome,
          tipo_atual: cliente.tipo_cliente,
          tipo_correto: tipoCorreto
        });
      }
    }

    console.log(`🔍 Clientes com tipo incorreto: ${clientesParaCorrigir.length}`);

    // Buscar contratos ativos que precisam ser corrigidos
    const { data: contratos, error: contratosError } = await supabase
      .from('contratos_clientes')
      .select('id, cliente_id, tipo_cliente, clientes!inner(nome)')
      .eq('status', 'ativo');

    if (contratosError) {
      console.error('❌ Erro ao buscar contratos:', contratosError);
      throw contratosError;
    }

    const contratosParaCorrigir: Array<{
      id: string;
      cliente_nome: string;
      tipo_atual: string | null;
      tipo_correto: string;
    }> = [];

    for (const contrato of contratos || []) {
      const clienteNome = (contrato.clientes as any).nome;
      // Buscar o tipo correto dos parâmetros de faturamento
      const tipoCorreto = await buscarTipoClienteParametros(supabase, contrato.cliente_id);
      
      // Se não encontrou nos parâmetros, pular este contrato
      if (!tipoCorreto) {
        console.log(`⚠️ Contrato do cliente ${clienteNome} não possui parâmetros de faturamento ativos`);
        continue;
      }
      
      if (contrato.tipo_cliente !== tipoCorreto) {
        contratosParaCorrigir.push({
          id: contrato.id,
          cliente_nome: clienteNome,
          tipo_atual: contrato.tipo_cliente,
          tipo_correto: tipoCorreto
        });
      }
    }

    console.log(`🔍 Contratos com tipo incorreto: ${contratosParaCorrigir.length}`);

    if (clientesParaCorrigir.length === 0 && contratosParaCorrigir.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos os clientes e contratos já estão com tipificação correta',
          clientesAtualizados: 0,
          contratosAtualizados: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar clientes
    let clientesAtualizados = 0;
    const errosClientes: Array<{ nome: string; erro: string }> = [];

    for (const cliente of clientesParaCorrigir) {
      console.log(`📝 Corrigindo cliente ${cliente.nome}: ${cliente.tipo_atual} → ${cliente.tipo_correto}`);
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update({ 
          tipo_cliente: cliente.tipo_correto,
          updated_at: new Date().toISOString()
        })
        .eq('id', cliente.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar cliente ${cliente.nome}:`, updateError);
        errosClientes.push({ nome: cliente.nome, erro: updateError.message });
      } else {
        clientesAtualizados++;
        console.log(`✅ Cliente ${cliente.nome} atualizado com sucesso`);
      }
    }

    // Atualizar contratos
    let contratosAtualizados = 0;
    const errosContratos: Array<{ cliente: string; erro: string }> = [];

    for (const contrato of contratosParaCorrigir) {
      console.log(`📝 Corrigindo contrato de ${contrato.cliente_nome}: ${contrato.tipo_atual} → ${contrato.tipo_correto}`);
      
      const { error: updateError } = await supabase
        .from('contratos_clientes')
        .update({ 
          tipo_cliente: contrato.tipo_correto,
          updated_at: new Date().toISOString()
        })
        .eq('id', contrato.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar contrato de ${contrato.cliente_nome}:`, updateError);
        errosContratos.push({ cliente: contrato.cliente_nome, erro: updateError.message });
      } else {
        contratosAtualizados++;
        console.log(`✅ Contrato de ${contrato.cliente_nome} atualizado com sucesso`);
      }
    }

    console.log(`✅ Sincronização concluída: ${clientesAtualizados} clientes e ${contratosAtualizados} contratos atualizados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída com sucesso`,
        clientesAtualizados,
        contratosAtualizados,
        totalClientesCorrigidos: clientesParaCorrigir.length,
        totalContratosCorrigidos: contratosParaCorrigir.length,
        detalhesClientes: clientesParaCorrigir,
        detalhesContratos: contratosParaCorrigir,
        errosClientes: errosClientes.length > 0 ? errosClientes : undefined,
        errosContratos: errosContratos.length > 0 ? errosContratos : undefined
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
