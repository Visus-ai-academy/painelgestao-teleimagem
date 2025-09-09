import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[limpar-clientes] Requisição recebida: ${req.method} ${req.url}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Iniciando limpeza da tabela clientes...')

    // Limpeza em lotes pequenos para evitar timeout e URL muito longa
    let totalPrecos = 0;
    let totalContratos = 0;
    let totalClientes = 0;

    // 1. Limpar preços em lotes de 100 (reduzido para evitar URL longa)
    console.log('[limpar-clientes] Iniciando limpeza de preços...')
    let hasMorePrecos = true;
    let loteAtual = 1;
    
    while (hasMorePrecos && loteAtual <= 50) { // Limite de segurança
      console.log(`[limpar-clientes] Processando lote ${loteAtual} de preços...`);
      
      const { data: precosLote, error: selectError } = await supabase
        .from('precos_servicos')
        .select('id')
        .limit(100); // Reduzido para 100

      if (selectError) {
        console.error('[limpar-clientes] Erro ao buscar preços:', selectError);
        throw selectError;
      }
      
      if (!precosLote || precosLote.length === 0) {
        console.log('[limpar-clientes] Não há mais preços para remover');
        hasMorePrecos = false;
        break;
      }

      // Usar DELETE com ORDER e LIMIT
      const { error: deleteError } = await supabase
        .from('precos_servicos')
        .delete()
        .order('created_at', { ascending: true })
        .limit(100);

      if (deleteError) {
        console.error('[limpar-clientes] Erro ao deletar preços:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao limpar preços: ${deleteError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalPrecos += precosLote.length;
      loteAtual++;
      console.log(`[limpar-clientes] Removidos ${precosLote.length} preços (total: ${totalPrecos})`);
      
      // Pequena pausa para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 2. Limpar contratos em lotes de 100
    console.log('[limpar-clientes] Iniciando limpeza de contratos...')
    let hasMoreContratos = true;
    loteAtual = 1;
    
    while (hasMoreContratos && loteAtual <= 50) { // Limite de segurança
      console.log(`[limpar-clientes] Processando lote ${loteAtual} de contratos...`);
      
      const { data: contratosLote, error: selectError } = await supabase
        .from('contratos_clientes')
        .select('id')
        .limit(100);

      if (selectError) {
        console.error('[limpar-clientes] Erro ao buscar contratos:', selectError);
        throw selectError;
      }
      
      if (!contratosLote || contratosLote.length === 0) {
        console.log('[limpar-clientes] Não há mais contratos para remover');
        hasMoreContratos = false;
        break;
      }

      // Usar DELETE com ORDER e LIMIT
      const { error: deleteError } = await supabase
        .from('contratos_clientes')
        .delete()
        .order('created_at', { ascending: true })
        .limit(100);

      if (deleteError) {
        console.error('[limpar-clientes] Erro ao deletar contratos:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao limpar contratos: ${deleteError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalContratos += contratosLote.length;
      loteAtual++;
      console.log(`[limpar-clientes] Removidos ${contratosLote.length} contratos (total: ${totalContratos})`);
      
      // Pequena pausa para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 3. Limpar clientes em lotes de 100
    console.log('[limpar-clientes] Iniciando limpeza de clientes...')
    let hasMoreClientes = true;
    loteAtual = 1;
    
    while (hasMoreClientes && loteAtual <= 50) { // Limite de segurança
      console.log(`[limpar-clientes] Processando lote ${loteAtual} de clientes...`);
      
      const { data: clientesLote, error: selectError } = await supabase
        .from('clientes')
        .select('id')
        .limit(100);

      if (selectError) {
        console.error('[limpar-clientes] Erro ao buscar clientes:', selectError);
        throw selectError;
      }
      
      if (!clientesLote || clientesLote.length === 0) {
        console.log('[limpar-clientes] Não há mais clientes para remover');
        hasMoreClientes = false;
        break;
      }

      // Usar DELETE com ORDER e LIMIT
      const { error: deleteError } = await supabase
        .from('clientes')
        .delete()
        .order('created_at', { ascending: true })
        .limit(100);

      if (deleteError) {
        console.error('[limpar-clientes] Erro ao deletar clientes:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao limpar clientes: ${deleteError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalClientes += clientesLote.length;
      loteAtual++;
      console.log(`[limpar-clientes] Removidos ${clientesLote.length} clientes (total: ${totalClientes})`);
      
      // Pequena pausa para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Verify cleanup
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    console.log(`[limpar-clientes] Limpeza concluída. Removidos: ${totalPrecos} preços, ${totalContratos} contratos, ${totalClientes} clientes`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Base limpa com sucesso! ${totalClientes} clientes, ${totalContratos} contratos e ${totalPrecos} preços removidos.`,
        registros_removidos: {
          clientes: totalClientes,
          contratos: totalContratos,
          precos: totalPrecos
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[limpar-clientes] Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Erro na limpeza: ${error.message}`,
        details: error.stack || 'Stack trace não disponível'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})