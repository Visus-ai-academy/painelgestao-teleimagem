import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { clientesParaLimpar } = await req.json()
    
    console.log('Limpando números de contrato para:', clientesParaLimpar)

    // Buscar IDs dos clientes
    const { data: clientes, error: clientesError } = await supabaseClient
      .from('clientes')
      .select('id, nome_fantasia')
      .in('nome_fantasia', clientesParaLimpar)

    if (clientesError) {
      throw clientesError
    }

    console.log(`Encontrados ${clientes.length} clientes para limpar`)

    // Limpar número de contrato
    const clienteIds = clientes.map(c => c.id)
    
    const { data: atualizado, error: updateError } = await supabaseClient
      .from('contratos_clientes')
      .update({ numero_contrato: null })
      .in('cliente_id', clienteIds)
      .select('id, cliente_id')

    if (updateError) {
      throw updateError
    }

    console.log(`Atualizados ${atualizado?.length || 0} contratos`)

    return new Response(
      JSON.stringify({
        sucesso: true,
        clientesAtualizados: clientes.length,
        contratosAtualizados: atualizado?.length || 0,
        clientes: clientes.map(c => c.nome_fantasia)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro ao limpar números de contrato:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
