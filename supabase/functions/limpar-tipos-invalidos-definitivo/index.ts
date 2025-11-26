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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🗑️ INICIANDO LIMPEZA DEFINITIVA DE TIPOS INVÁLIDOS')
    
    // TIPOS INVÁLIDOS QUE NUNCA DEVERIAM EXISTIR
    const TIPOS_INVALIDOS = ['alta_complexidade', 'padrao', 'oncologia', 'urgencia']
    
    // 1. Contar registros com tipos inválidos
    const { count: totalAntes, error: countError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('tipo_faturamento', TIPOS_INVALIDOS)

    if (countError) {
      console.error('❌ Erro ao contar registros:', countError)
      throw countError
    }

    console.log(`📊 Encontrados ${totalAntes} registros com tipos inválidos:`, TIPOS_INVALIDOS)

    if (!totalAntes || totalAntes === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: true,
          mensagem: 'Nenhum registro com tipo inválido encontrado',
          registros_limpos: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. LIMPAR TODOS OS REGISTROS COM TIPOS INVÁLIDOS
    console.log('🧹 Limpando registros com tipos inválidos...')
    
    const { error: updateError } = await supabase
      .from('volumetria_mobilemed')
      .update({ 
        tipo_faturamento: null,
        updated_at: new Date().toISOString()
      })
      .in('tipo_faturamento', TIPOS_INVALIDOS)

    if (updateError) {
      console.error('❌ Erro ao limpar tipos inválidos:', updateError)
      throw updateError
    }

    console.log('✅ Limpeza concluída com sucesso')

    // 3. Verificar se realmente limpou
    const { count: totalDepois, error: verifyError } = await supabase
      .from('volumetria_mobilemed')
      .select('*', { count: 'exact', head: true })
      .in('tipo_faturamento', TIPOS_INVALIDOS)

    if (verifyError) {
      console.error('❌ Erro ao verificar limpeza:', verifyError)
      throw verifyError
    }

    console.log(`🎯 Registros restantes com tipos inválidos: ${totalDepois}`)

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        mensagem: `${totalAntes} registros limpos com sucesso`,
        registros_limpos: totalAntes,
        registros_restantes: totalDepois,
        tipos_removidos: TIPOS_INVALIDOS
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ERRO:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false,
        erro: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
