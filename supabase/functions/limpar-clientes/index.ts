import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Iniciando limpeza da tabela clientes...')

    // Limpeza em lotes para evitar timeout
    let totalPrecos = 0;
    let totalContratos = 0;
    let totalClientes = 0;

    // 1. Limpar preços em lotes de 1000
    console.log('Limpando preços...')
    let hasMorePrecos = true;
    while (hasMorePrecos) {
      const { data: precosLote, error: selectError } = await supabase
        .from('precos_servicos')
        .select('id')
        .limit(1000);

      if (selectError) throw selectError;
      
      if (!precosLote || precosLote.length === 0) {
        hasMorePrecos = false;
        break;
      }

      const ids = precosLote.map(p => p.id);
      const { error: deleteError } = await supabase
        .from('precos_servicos')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Erro ao limpar preços:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalPrecos += precosLote.length;
      console.log(`Removidos ${precosLote.length} preços (total: ${totalPrecos})`);
    }

    // 2. Limpar contratos em lotes de 1000  
    console.log('Limpando contratos...')
    let hasMoreContratos = true;
    while (hasMoreContratos) {
      const { data: contratosLote, error: selectError } = await supabase
        .from('contratos_clientes')
        .select('id')
        .limit(1000);

      if (selectError) throw selectError;
      
      if (!contratosLote || contratosLote.length === 0) {
        hasMoreContratos = false;
        break;
      }

      const ids = contratosLote.map(c => c.id);
      const { error: deleteError } = await supabase
        .from('contratos_clientes')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Erro ao limpar contratos:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalContratos += contratosLote.length;
      console.log(`Removidos ${contratosLote.length} contratos (total: ${totalContratos})`);
    }

    // 3. Limpar clientes em lotes de 1000
    console.log('Limpando clientes...')
    let hasMoreClientes = true;
    while (hasMoreClientes) {
      const { data: clientesLote, error: selectError } = await supabase
        .from('clientes')
        .select('id')
        .limit(1000);

      if (selectError) throw selectError;
      
      if (!clientesLote || clientesLote.length === 0) {
        hasMoreClientes = false;
        break;
      }

      const ids = clientesLote.map(c => c.id);
      const { error: deleteError } = await supabase
        .from('clientes')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Erro ao limpar clientes:', deleteError)
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      totalClientes += clientesLote.length;
      console.log(`Removidos ${clientesLote.length} clientes (total: ${totalClientes})`);
    }

    // Verify cleanup
    const { count } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })

    console.log(`Limpeza concluída. Removidos: ${totalPrecos} preços, ${totalContratos} contratos, ${totalClientes} clientes`)

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
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})