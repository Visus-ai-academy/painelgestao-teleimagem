import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚫 Buscando e excluindo registros com modalidade US...')

    // Buscar registros US
    const { data: registrosUS } = await supabase
      .from('volumetria_mobilemed')
      .select('*')
      .eq('MODALIDADE', 'US')

    const totalUS = registrosUS?.length || 0
    console.log(`📊 Encontrados ${totalUS} registros com modalidade US`)

    if (totalUS > 0) {
      // Salvar na tabela de rejeições
      const rejeicoes = registrosUS!.map(reg => ({
        empresa: reg.EMPRESA || 'N/I',
        nome_paciente: reg.NOME_PACIENTE || 'N/I',
        arquivo_fonte: reg.arquivo_fonte || 'N/I',
        erro_detalhes: 'MODALIDADE_US_EXCLUIDA: Exames não realizados/faturados, sem repasse médico',
        dados_originais: reg,
        status: 'rejeitado',
        created_at: new Date().toISOString()
      }))

      for (let i = 0; i < rejeicoes.length; i += 20) {
        await supabase.from('volumetria_erros').insert(rejeicoes.slice(i, i + 20))
      }

      // Excluir registros
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .delete()
        .eq('MODALIDADE', 'US')

      console.log(`✅ ${count} registros excluídos`)

      return new Response(
        JSON.stringify({
          success: true,
          registros_excluidos: count,
          registros_salvos_rejeicoes: totalUS
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Nenhum registro US encontrado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
