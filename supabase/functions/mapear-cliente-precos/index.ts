import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { nome_origem, nome_destino } = await req.json()

    console.log(`🔄 Mapeando preços de "${nome_origem}" para "${nome_destino}"`)

    // Buscar cliente destino
    const { data: clientes, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, nome_mobilemed')
      .or(`nome.ilike.%${nome_destino}%,nome_fantasia.ilike.%${nome_destino}%,nome_mobilemed.ilike.%${nome_destino}%`)
      .limit(1)

    if (clienteError || !clientes || clientes.length === 0) {
      throw new Error(`Cliente destino "${nome_destino}" não encontrado`)
    }

    const cliente = clientes[0]

    console.log(`✅ Cliente encontrado: ${cliente.nome} (ID: ${cliente.id})`)

    // Atualizar preços sem cliente que têm o nome_origem
    const { data: updated, error: updateError } = await supabase
      .from('precos_servicos')
      .update({ 
        cliente_id: cliente.id,
        updated_at: new Date().toISOString()
      })
      .is('cliente_id', null)
      .or(`descricao.ilike.%${nome_origem}%,observacoes.ilike.%${nome_origem}%`)
      .select('id')

    if (updateError) {
      throw updateError
    }

    const total = updated?.length || 0
    console.log(`✅ ${total} preços atualizados`)

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        total_atualizados: total,
        mensagem: `${total} preços de "${nome_origem}" foram atribuídos ao cliente "${cliente.nome}"`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro:', error)
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
