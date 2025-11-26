import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de clientes NC (deve ser NC no cliente e contrato)
const CLIENTES_NC = [
  "CBU",
  "CDICARDIO",
  "CDIGOIAS",
  "CICOMANGRA",
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "RADMED",
  "TRANSDUSON",
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Lista de clientes NC1 (deve ser NC1 no cliente e contrato)
const CLIENTES_NC1: string[] = [
  // Adicionar clientes NC1 conforme necessário
];

// Função para determinar o tipo correto do cliente
function determinarTipoCliente(nomeCliente: string): "CO" | "NC" | "NC1" {
  if (CLIENTES_NC1.includes(nomeCliente)) return "NC1";
  if (CLIENTES_NC.includes(nomeCliente)) return "NC";
  return "CO";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando sincronização de tipo_cliente baseada nas regras de negócio...');

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

    // Identificar clientes que precisam ter o tipo corrigido
    const clientesParaCorrigir: Array<{
      id: string;
      nome: string;
      tipo_atual: string | null;
      tipo_correto: string;
    }> = [];

    for (const cliente of clientes || []) {
      const tipoCorreto = determinarTipoCliente(cliente.nome);
      
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
      const tipoCorreto = determinarTipoCliente(clienteNome);
      
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
